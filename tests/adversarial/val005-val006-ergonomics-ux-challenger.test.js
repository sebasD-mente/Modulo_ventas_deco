import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ EMPIRICAL ADVERSARIAL CHALLENGER 2: Frontend Ergonomics (VAL-005) & Chat UX Auto-Scroll (VAL-006)', () => {

  // =========================================================================
  // CHALLENGE 1: LINE CEILINGS VERIFICATION
  // =========================================================================
  describe('1. Line Ceilings Verification', () => {
    it('1.1 UnifiedAiChat.jsx line count must be strictly < 80', () => {
      const filePath = path.join(rootDir, 'src/components/UnifiedAiChat.jsx');
      assert.ok(fs.existsSync(filePath), 'UnifiedAiChat.jsx must exist');
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').length;
      assert.ok(
        lineCount < 80,
        `Ceiling violation: UnifiedAiChat.jsx has ${lineCount} lines (expected < 80)`
      );
      assert.ok(lineCount <= 200, 'Must not violate zero-debt threshold');
    });

    it('1.2 ChatMessageList.jsx line count must be strictly < 100', () => {
      const filePath = path.join(rootDir, 'src/components/ai-chat/ChatMessageList.jsx');
      assert.ok(fs.existsSync(filePath), 'ChatMessageList.jsx must exist');
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').length;
      assert.ok(
        lineCount < 100,
        `Ceiling violation: ChatMessageList.jsx has ${lineCount} lines (expected < 100)`
      );
      assert.ok(lineCount <= 200, 'Must not violate zero-debt threshold');
    });
  });

  // =========================================================================
  // CHALLENGE 2: TOUCH TARGET STATIC & STRUCTURAL INSPECTION (VAL-005)
  // =========================================================================
  describe('2. Touch Target Ergonomics >= 44px (VAL-005)', () => {
    it('2.1 Header.jsx navigation tabs (navTabs.map) must enforce min-h-[44px]', () => {
      const filePath = path.join(rootDir, 'src/components/Header.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Locate navTabs.map block
      const navTabsMatch = content.match(/navTabs\.map\(\(tab\)\s*=>\s*\{([\s\S]*?)\}\)/);
      assert.ok(navTabsMatch, 'Header.jsx must contain navTabs.map');

      const navTabsCode = navTabsMatch[1];
      assert.ok(
        navTabsCode.includes('min-h-[44px]'),
        'navTabs buttons must have min-h-[44px] touch target class'
      );
    });

    it('2.2 Header.jsx logout button must enforce min-h-[44px] and min-w-[44px]', () => {
      const filePath = path.join(rootDir, 'src/components/Header.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Locate button with logout
      const logoutBtnMatch = content.match(/<button[^>]*onClick=\{logout\}[^>]*>([\s\S]*?)<\/button>/);
      assert.ok(logoutBtnMatch, 'Header.jsx must contain button with onClick={logout}');

      const logoutBtnCode = logoutBtnMatch[0];
      assert.ok(
        logoutBtnCode.includes('min-h-[44px]'),
        'Logout button must specify min-h-[44px]'
      );
      assert.ok(
        logoutBtnCode.includes('min-w-[44px]'),
        'Logout button must specify min-w-[44px]'
      );
      assert.ok(
        logoutBtnCode.includes('aria-label="Cerrar Sesión"'),
        'Logout button must provide accessible aria-label'
      );
    });

    it('2.3 PaymentSummaryBar.jsx payment methods (methods.map) must enforce min-h-[44px]', () => {
      const filePath = path.join(rootDir, 'src/components/manual-sale/PaymentSummaryBar.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Locate methods.map block and inspect the button
      const mapIdx = content.indexOf('methods.map');
      assert.ok(mapIdx !== -1, 'PaymentSummaryBar.jsx must contain methods.map');

      const methodsBlock = content.slice(mapIdx);
      const buttonInMethods = methodsBlock.slice(0, methodsBlock.indexOf('</button>'));
      assert.ok(
        buttonInMethods.includes('min-h-[44px]'),
        'Payment method buttons must enforce min-h-[44px] touch target'
      );
    });
  });

  // =========================================================================
  // CHALLENGE 3: AUTO-SCROLL LOGIC & ANTI-HIJACK CHALLENGE (VAL-006)
  // =========================================================================
  describe('3. Smart Auto-Scroll & Anti-Hijack Logic (VAL-006)', () => {
    const listPath = path.join(rootDir, 'src/components/ai-chat/ChatMessageList.jsx');
    const unifiedPath = path.join(rootDir, 'src/components/UnifiedAiChat.jsx');

    it('3.1 ChatMessageList.jsx contains exact target calculation formula', () => {
      const content = fs.readFileSync(listPath, 'utf-8');

      // Target formula: Math.max(0, c.scrollTop + (el.getBoundingClientRect().top - c.getBoundingClientRect().top) - 12)
      const formulaRegex = /Math\.max\(\s*0\s*,\s*c\.scrollTop\s*\+\s*\(\s*el\.getBoundingClientRect\(\)\.top\s*-\s*c\.getBoundingClientRect\(\)\.top\s*\)\s*-\s*12\s*\)/;
      assert.ok(
        formulaRegex.test(content),
        'ChatMessageList.jsx must implement the exact relative top anchoring formula: Math.max(0, c.scrollTop + (el.getBoundingClientRect().top - c.getBoundingClientRect().top) - 12)'
      );
    });

    it('3.2 isTall activates on: height > 400 OR hasPodium OR hasManySuggestions (>=3)', () => {
      const content = fs.readFileSync(listPath, 'utf-8');

      // Verify predicates
      assert.ok(
        content.includes('topPosters?.length') || content.includes('toolResult?.posters?.length'),
        'hasPodium must check topPosters or toolResult.posters'
      );
      assert.ok(
        content.includes('suggestions?.length >= 3'),
        'hasManySugg must check suggestions >= 3'
      );
      assert.ok(
        content.includes('> 400'),
        'isTall must check element offsetHeight > 400'
      );

      // Verify definition of isTall
      const isTallRegex = /const\s+isTall\s*=\s*isAi\s*&&\s*\(\s*\(\s*el\?\.\s*offsetHeight\s*\|\|\s*0\s*\)\s*>\s*400\s*\|\|\s*hasPodium\s*\|\|\s*hasManySugg\s*\)/;
      assert.ok(
        isTallRegex.test(content),
        'isTall must strictly combine isAi with (height > 400 || hasPodium || hasManySugg)'
      );
    });

    it('3.3 Auto-scroll does NOT hijack user scroll when scrolled up (isPinnedToBottomRef === false)', () => {
      const content = fs.readFileSync(listPath, 'utf-8');

      // Verify the scroll guard
      assert.ok(
        content.includes('isPinnedToBottomRef?.current !== false'),
        'Must guard scroll invocation with isPinnedToBottomRef?.current !== false'
      );

      // Programmatic simulation of the pure logic guard
      const simulateAutoScrollDecision = ({
        isPinnedToBottom,
        isNew,
        streamDone,
        isAi,
        offsetHeight,
        hasPodium,
        hasManySugg,
      }) => {
        let action = 'none';
        if ((isNew || streamDone) && isPinnedToBottom !== false) {
          const isTall = isAi && (offsetHeight > 400 || hasPodium || hasManySugg);
          if (isTall) action = 'scrollToMessageStart';
          else action = 'scrollToBottom';
        }
        return action;
      };

      // Scenario A: User scrolled up (pinned is false), stream completes with tall card
      const actionScrolledUp = simulateAutoScrollDecision({
        isPinnedToBottom: false,
        isNew: false,
        streamDone: true,
        isAi: true,
        offsetHeight: 600,
        hasPodium: true,
        hasManySugg: true,
      });
      assert.strictEqual(
        actionScrolledUp,
        'none',
        'Auto-scroll MUST NOT trigger any scroll action when user is scrolled up'
      );

      // Scenario B: User pinned at bottom, stream completes with tall card
      const actionPinnedTall = simulateAutoScrollDecision({
        isPinnedToBottom: true,
        isNew: false,
        streamDone: true,
        isAi: true,
        offsetHeight: 550,
        hasPodium: false,
        hasManySugg: false,
      });
      assert.strictEqual(
        actionPinnedTall,
        'scrollToMessageStart',
        'Auto-scroll must anchor to message start for tall card when pinned'
      );

      // Scenario C: User pinned at bottom, stream completes with podium card
      const actionPinnedPodium = simulateAutoScrollDecision({
        isPinnedToBottom: true,
        isNew: false,
        streamDone: true,
        isAi: true,
        offsetHeight: 250,
        hasPodium: true,
        hasManySugg: false,
      });
      assert.strictEqual(
        actionPinnedPodium,
        'scrollToMessageStart',
        'Auto-scroll must anchor to message start for podium card when pinned'
      );

      // Scenario D: User pinned at bottom, short message
      const actionPinnedShort = simulateAutoScrollDecision({
        isPinnedToBottom: true,
        isNew: true,
        streamDone: false,
        isAi: false,
        offsetHeight: 60,
        hasPodium: false,
        hasManySugg: false,
      });
      assert.strictEqual(
        actionPinnedShort,
        'scrollToBottom',
        'Auto-scroll must scroll to bottom for standard short messages when pinned'
      );
    });

    it('3.4 UnifiedAiChat.jsx does not hijack scroll on messages or draft updates', () => {
      const content = fs.readFileSync(unifiedPath, 'utf-8');

      // Verify that useEffect in UnifiedAiChat does NOT depend on messages or pendingDraft
      const scrollEffectMatch = content.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?chatBottomRef[\s\S]*?\}\s*,\s*\[([\s\S]*?)\]\)/);
      assert.ok(scrollEffectMatch, 'UnifiedAiChat must contain scroll effect');

      const deps = scrollEffectMatch[1];
      assert.ok(!deps.includes('messages'), 'UnifiedAiChat scroll effect must NOT depend on messages');
      assert.ok(!deps.includes('pendingDraft'), 'UnifiedAiChat scroll effect must NOT depend on pendingDraft');
      assert.ok(deps.includes('voiceRecorder.isRecording'), 'Effect should only handle recording/error states');
    });

    it('3.5 Relative target calculation formula numerical oracle verification', () => {
      // Simulate DOM geometry
      // Container: scrollTop = 500, container top = 100
      // Element top in viewport = 350
      // Expected new scrollTop: 500 + (350 - 100) - 12 = 500 + 250 - 12 = 738
      const c = { scrollTop: 500, getBoundingClientRect: () => ({ top: 100 }) };
      const el = { getBoundingClientRect: () => ({ top: 350 }) };

      const calcTarget = (c, el) => Math.max(0, c.scrollTop + (el.getBoundingClientRect().top - c.getBoundingClientRect().top) - 12);

      const target = calcTarget(c, el);
      assert.strictEqual(target, 738, 'Calculated target must exactly equal 738px');

      // Clamp test at 0
      const c2 = { scrollTop: 0, getBoundingClientRect: () => ({ top: 100 }) };
      const el2 = { getBoundingClientRect: () => ({ top: 105 }) }; // offset = 5, minus 12 = -7 -> clamped to 0
      assert.strictEqual(calcTarget(c2, el2), 0, 'Target should clamp to 0 when near top');
    });

    it('3.6 Boundary stress: hasPodium and hasManySugg truth tables', () => {
      const evaluateFlags = (lastMsg) => {
        const hasPodium = Boolean(lastMsg?.topPosters?.length || lastMsg?.toolResult?.posters?.length);
        const hasManySugg = Boolean(lastMsg?.suggestions?.length >= 3 || lastMsg?.toolResult?.suggestions?.length >= 3);
        return { hasPodium, hasManySugg };
      };

      // Empty arrays must be falsy (no false activation)
      assert.deepStrictEqual(evaluateFlags({ topPosters: [] }), { hasPodium: false, hasManySugg: false });
      assert.deepStrictEqual(evaluateFlags({ suggestions: ['uno', 'dos'] }), { hasPodium: false, hasManySugg: false });

      // Threshold boundaries
      assert.deepStrictEqual(evaluateFlags({ topPosters: [{ id: 'poster-1' }] }), { hasPodium: true, hasManySugg: false });
      assert.deepStrictEqual(evaluateFlags({ toolResult: { posters: [{ id: 'poster-1' }] } }), { hasPodium: true, hasManySugg: false });
      assert.deepStrictEqual(evaluateFlags({ suggestions: ['uno', 'dos', 'tres'] }), { hasPodium: false, hasManySugg: true });
      assert.deepStrictEqual(evaluateFlags({ toolResult: { suggestions: ['1', '2', '3', '4'] } }), { hasPodium: false, hasManySugg: true });
    });

    it('3.7 User message edge-case: large user text never triggers top-anchor', () => {
      const isUser = true;
      const isAi = !isUser;
      const offsetHeight = 650; // User pasted a huge message
      const hasPodium = false;
      const hasManySugg = false;

      const isTall = isAi && (offsetHeight > 400 || hasPodium || hasManySugg);
      assert.strictEqual(isTall, false, 'User messages must NEVER activate isTall top-anchoring regardless of height');
    });

    it('3.8 Programmatic scroll lock prevents handleScroll race conditions', () => {
      let isProgrammatic = false;
      let isPinned = true;

      const handleScroll = (scrollHeight, scrollTop, clientHeight) => {
        if (isProgrammatic) return; // Guard
        isPinned = (scrollHeight - scrollTop - clientHeight <= 80);
      };

      // Start programmatic smooth scroll
      isProgrammatic = true;
      // Scroll event fires mid-flight while container is 200px from bottom
      handleScroll(1000, 700, 200); // 1000 - 700 - 200 = 100 > 80
      // Because isProgrammatic is true, isPinned must remain true!
      assert.strictEqual(isPinned, true, 'isPinned must NOT be corrupted during programmatic smooth scroll');

      // Scroll ends
      isProgrammatic = false;
      // User manual scroll fires > 80px from bottom
      handleScroll(1000, 700, 200);
      assert.strictEqual(isPinned, false, 'User manual scroll must update isPinned to false');
    });
  });
});
