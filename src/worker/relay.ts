import type { FrameReportWire } from '@/shared/messages';
import type { Message } from '@/shared/messages';

// 프레임 메시지 중계(D-03, D-09, T-01-19, T-01-21): 각 프레임의 frame/report(자기 selfPath +
// 자식의 상대 순번, RESEARCH A2 정정 — chrome.runtime.getFrameId는 Chrome에 없다)를 탭별로
// 모아 맨 위(frameId 0)에 frames/reports로 그대로 넘긴다 — selfPath↔실제 frameId 맞춤
// (resolveReports)은 맨 위(content.ts)가 한다. hints/press는 맨 위(sender.frameId === 0)에서
// 온 것만 받아 해당 프레임에 press/request로 돌려준다. hints/state는 탭의 모든 프레임에 방송한다.
// 탭이 닫히거나 새로 이동하면 그 탭의 보고를 지운다(보고 폭주 방지).

export interface Relay {
  handle(message: Message, sender: chrome.runtime.MessageSender): void;
}

// 부모의 자식 목록에서 순번(index)이 바뀌었는지만 보면 되므로, 순번+pathKey 쌍의 집합을 비교한다
// (개수만 보면 "지우고 다른 걸 그 자리에 새로 넣기" 같은 교체를 놓친다).
function childrenSignature(children: FrameReportWire['children']): string {
  return children
    .map((c) => `${c.index.toString()}:${c.pathKey}`)
    .sort()
    .join(',');
}

function isPrefixOf(prefix: number[], path: number[]): boolean {
  return prefix.length <= path.length && prefix.every((value, i) => path[i] === value);
}

export function createRelay(): Relay {
  const reportsByTab = new Map<number, Map<number, FrameReportWire>>();

  function reportsFor(tabId: number): Map<number, FrameReportWire> {
    let tabReports = reportsByTab.get(tabId);
    if (!tabReports) {
      tabReports = new Map();
      reportsByTab.set(tabId, tabReports);
    }
    return tabReports;
  }

  chrome.tabs.onRemoved.addListener((tabId) => {
    reportsByTab.delete(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      reportsByTab.delete(tabId);
    }
  });

  return {
    handle(message, sender) {
      const tabId = sender.tab?.id;
      const senderFrameId = sender.frameId;
      if (tabId === undefined || senderFrameId === undefined) {
        return;
      }

      if (message.type === 'frame/report') {
        // 보고 안의 frameId는 신뢰하지 않고 Chrome이 채운 sender.frameId로 덮어쓴다(스푸핑 방지).
        const tabReports = reportsFor(tabId);
        const previous = tabReports.get(senderFrameId);
        const topologyChanged = !previous || childrenSignature(previous.children) !== childrenSignature(message.report.children);

        if (previous && topologyChanged) {
          // 지워진 자식(예전엔 있었는데 이번 보고엔 없는 pathKey)의 옛 경로(부모 경로+옛 순번)를
          // 탭 보고에서 통째로 지운다 — 안 지우면 뒤에 남은 형제가 순번이 당겨져 그 옛 경로를
          // 새로 차지했을 때(예: 지워진 형이 순번 1이었고 동생이 그 뒤를 이어 순번 1이 됨)
          // resolveReports가 selfPath 문자열이 같은 두 보고 중 죽은 쪽을 골라 죽은 가지로
          // 잘못 연결한다(재현 확인됨) — 살아있는 형제는 곧 자기 새 경로로 다시 보고한다.
          const newPathKeys = new Set(message.report.children.map((c) => c.pathKey));
          for (const oldChild of previous.children) {
            if (newPathKeys.has(oldChild.pathKey)) {
              continue;
            }
            const deadPrefix = [...previous.selfPath, oldChild.index];
            for (const [frameId, report] of tabReports) {
              if (isPrefixOf(deadPrefix, report.selfPath)) {
                tabReports.delete(frameId);
              }
            }
          }
        }

        tabReports.set(senderFrameId, { ...message.report, frameId: senderFrameId });
        const reports = Array.from(tabReports.entries()).map(([frameId, report]) => ({ frameId, report }));
        void chrome.tabs.sendMessage(tabId, { type: 'frames/reports', reports }, { frameId: 0 });
        if (topologyChanged) {
          // 이 프레임의 자식 iframe 순번·구성이 바뀌었다 — 다른 형제 프레임들의 selfPath가
          // 낡았을 수 있으니 모두에게 즉시 다시 계산해 보고하라고 알린다(방송, frameId 생략).
          void chrome.tabs.sendMessage(tabId, { type: 'frame/refresh' });
        }
        return;
      }

      if (message.type === 'hints/press') {
        if (senderFrameId !== 0) {
          // T-01-19: 맨 위 content script만 누르기 요청을 시작할 수 있다.
          return;
        }
        void chrome.tabs.sendMessage(
          tabId,
          { type: 'press/request', itemId: message.itemId, framePath: message.framePath },
          { frameId: message.frameId },
        );
        return;
      }

      if (message.type === 'hints/state') {
        // frameId를 생략하면 탭의 모든 프레임에 간다.
        void chrome.tabs.sendMessage(tabId, { type: 'hints/state', visible: message.visible });
        return;
      }

      if (message.type === 'hints/key') {
        // Task 3: 어느 프레임에서 왔든 판단은 언제나 맨 위(frameId 0)가 한다.
        void chrome.tabs.sendMessage(tabId, { type: 'hints/key', code: message.code }, { frameId: 0 });
        return;
      }

      if (message.type === 'mode/report') {
        void chrome.tabs.sendMessage(tabId, { type: 'mode/report', mode: message.mode }, { frameId: 0 });
      }
    },
  };
}
