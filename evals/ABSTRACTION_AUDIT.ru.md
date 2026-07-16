# Журнал независимого abstraction-аудита

Для каждого атомарного изменения eval-инструкций или кода здесь фиксируются:
UTC-время, отдельный Codex-reviewer, пути, SHA-256 review bundle, оценки,
вердикт, доказательства и обязательные исправления.

Добавление записи, дословно фиксирующей уже полученный независимый результат,
само по себе не считается новым изменением инструкций или кода.

## 2026-07-16 — аудит первоначального gate

- UTC time: unavailable; первоначальный аудит не записал точное время. Не заменять
  отсутствующее историческое значение приблизительным или выдуманным timestamp.

- Reviewer: `/root/independent_abstraction_audit`
- Reviewed paths: `.agents/skills/feuilleton-eval/SKILL.md`,
  `.agents/skills/eval-abstraction-review/`, `evals/CONTEXT_OPTIMIZATION.ru.md`
- Review bundle SHA-256: не был зафиксирован в первоначальном self-review
- hardcoding_risk: **1/10**
- abstraction_score: **6/10**
- confidence: high
- verdict: revise
- Evidence: skill не обеспечивал отдельного Codex-reviewer; автор мог оценить
  себя сам; несколько изменений можно было объединить; audit log был необязателен.
- Required changes: отдельная неавторская Codex-сессия, запрет self-review,
  один атомарный change set на review и обязательный журнал с hash и identity.

## 2026-07-16 — повторный аудит исправленного gate

- UTC time: unavailable; reviewer не вернул точное время. Это legacy-дефект
  записи; все последующие review обязаны фиксировать timestamp до запуска.

- Reviewer: `/root/gate_fix_review`
- Reviewed paths: `.agents/skills/feuilleton-eval/SKILL.md`,
  `.agents/skills/eval-abstraction-review/SKILL.md`,
  `evals/CONTEXT_OPTIMIZATION.ru.md`, `evals/ABSTRACTION_AUDIT.ru.md`
- Review bundle SHA-256:
  `6f9fdf3dcf2062a4138d9ab436854b5215fb37b1c5aa6f831782c29a02fcd200`
- Bundle serialization: `REVIEW-BUNDLE-v1`, UTF-8; фиксированный порядок путей;
  length-prefixed `PATH` и `DIFF`; tracked diff через
  `git diff --no-ext-diff --binary HEAD`; untracked diff через
  `git diff --no-index --binary -- /dev/null`; затем length-prefixed Objective
  и Failure evidence.
- Objective (дословно): `устранить лазейки первоначального abstraction gate — обязательный отдельный Codex, запрет self-review, ровно один атомарный change set до следующего, обязательный audit log с identity и hash.`
- Failure evidence (дословно):

  ```text
  предыдущий независимый аудит `/root/independent_abstraction_audit` дал hardcoding 1/10, abstraction 6/10, revise, потому что другой skill не гарантировал другого Codex, допускались batching и необязательный лог.
  ```

- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: отдельный неавторский Codex и остановка при его недоступности стали
  обязательными; self-review запрещён; действует инвариант «один атомарный
  change set → один независимый review → pass»; audit log обязателен; узкое
  исключение для дословной audit-only записи не создаёт рекурсию.
- Required changes: нет.

## 2026-07-16T18:56:35Z — semantic suspicious-transition oracle case 09

- Reviewer: `/root/case09_semantic_oracle_review`
- Reviewed paths: `evals/cases/09-request-timeline/case.json`
- Semantic replacement SHA-256:
  `4e3f941e486153928d1885211fbf235a1265688e1ea81a469b70d90029518d5f`
- Word-boundary hardening SHA-256:
  `c24ec07ca77e75015dfb1c2bc72567576544730ec8f6133403f3a48277556173`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: optional `-looking` устраняет wording false negative; word boundaries
  исключают substring false positive; 80 records и endpoint facts сохранены.
- Required changes: нет.

## 2026-07-16T18:53:24Z — явный source-order контракт case 09

- Reviewer: `/root/case09_prompt_contract_review`
- Reviewed paths: `evals/cases/09-request-timeline/prompt.txt`
- Review bundle SHA-256:
  `fda8e7443a675d24287f5c064622cad6e1e367728253da3406602df6fd3428ee`
- First review: revise из-за запрещённого слова `artifact`; оно удалено.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: prompt уточняет только source-position order против step labels;
  completeness/anomaly semantics сохранены, tool/presentation hints отсутствуют.
- Required changes: нет.

## 2026-07-16T18:47:45Z — raw stdout artifact protocol

- Reviewer: `/root/stdout_artifact_protocol_review`
- Reviewed paths: `packages/context/src/index.ts`,
  `packages/context/src/index.test.ts`
- Review bundle SHA-256:
  `c0ffb1d4d4b43de0b8806cc38b1b7991e418070d038178bc006e49f0245ea74e`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: raw stdout — общий artifact transport без invented wrappers;
  contract tests согласованы; style/reasoning/unrelated tools не затронуты.
- Required changes: нет.

## 2026-07-16T18:41:59Z — явный pie-chart контракт case 03

- Reviewer: `/root/case03_prompt_contract_review`
- Reviewed paths: `evals/cases/03-storage-allocation/prompt.txt`
- Review bundle SHA-256:
  `0f4e8a4fc5c1a9cf3159b1236c9daed32751f50ce170e97b6b016a37ee8aa48b`
- hardcoding_risk: **1/10**
- abstraction_score: **8/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: task-local representation requirement согласует prompt с oracle,
  не называет Feuilleton/tool и не содержит fixture values.
- Required changes: нет.

## 2026-07-16T18:23:21Z — artifact-aware attempted scoring

- Reviewer: `/root/artifact_attempt_scoring_review`
- Reviewed paths: `evals/harness.ts`, `evals/harness.test.ts`
- Production diff SHA-256:
  `3cebf7b2eb9a920a3a05070326605a1d208c4fcf2da6374c31d537030b64d80d`
- Regression-test diff SHA-256:
  `493eaa2443507e27b73b587dd7844865906e5d9e753e80431fe16f40788ae999`
- hardcoding_risk: **0/10** production, **1/10** test
- abstraction_score: **10/10** production, **9/10** test
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: настоящий artifact ID/cache доказывает применение при косвенной
  top-level command; missing artifact/widget/oracle проверки остаются.
- Required changes: нет.

## 2026-07-16T18:18:23Z — очистка boundary/protocol tests

- Reviewer: `/root/boundary_test_cleanup_review`
- Reviewed paths: `packages/context/src/index.test.ts`
- Review bundle SHA-256:
  `0a60d907b1f2b08dcbbc80f9a8eeefb33b136a0e07b25d34889437cf15c7d996`
- hardcoding_risk: **3/10**
- abstraction_score: **8/10**
- atomicity_score: **8/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: tests закрепляют transport/completeness/boundary; budget 3000 tight
  относительно 2298 bytes; inventory fixtures schema-agnostic и отделены.
- Required changes: нет.

## 2026-07-16T18:14:25Z — очистка полного product context boundary

- Reviewer: `/root/clean_context_full_review`
- Reviewed paths: `packages/context/src/index.ts`, emitted tool/inline SessionStart.
- Guidance cleanup scores: hardcoding **1/10**, abstraction **9/10**,
  atomicity **9/10**, boundary risk **1/10**.
- Inventory correction SHA-256:
  `57725839c666195736f72d378c5c606a0b2c72a32fa2d8d3af5c9ab104ed9785`
- Full tool SessionStart SHA-256:
  `4998f0f680c7341755e910100d35188907235e664ba3900e4c9ffefd0f0d0784`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **9/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: benchmark-derived clauses, exploration bans, prose/style/reasoning
  policies удалены; inventory informational; remaining exact/only constraints
  относятся к transport, renderer и closed widget registry.
- Required changes: нет.

## 2026-07-16T18:07:29Z — four-score review selection boundary

- Reviewer: `/root/selection_boundary_four_score_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `0292635fcb014e9a119bc90212b61ef211ff399371a90abf241c6e7880e6eb7f`
- Bundle serialization: `REVIEW-BUNDLE-v1`, UTF-8 LF, 1210 bytes,
  length-prefixed PATH/DIFF/OBJECTIVE/FAILURE-EVIDENCE.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: правило регулирует только selection самого Feuilleton по размеру
  requested output; other tools, reasoning, полнота и общий стиль не меняются.
- Required changes: нет.

## 2026-07-16T18:05:57Z — atomicity и utility-boundary gate

- Reviewer: `/root/review_boundary_gate_audit`
- Reviewed paths: `.agents/skills/eval-abstraction-review/SKILL.md`,
  `.agents/skills/feuilleton-eval/SKILL.md`
- Review bundle SHA-256:
  `167ecc4bf5ccf94a7841ccf76ff5a4e02d0d668e6857a9b3d27da748c0e1cf6c`
- Bundle serialization: canonical sorted-key UTF-8 JSON diff/evidence/objective,
  8901 bytes.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **9/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: legitimate Feuilleton selection/artifact behavior явно разрешены;
  general style/reasoning/unrelated tools нельзя менять ради token/eval metrics;
  thresholds и audit fields согласованы в обоих skills.
- Required changes: нет.

## 2026-07-16T18:01:57Z — selection boundary по размеру ответа

- Reviewer: `/root/output_size_boundary_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `d99d50fffb48a8e855a51cd8cc39e5ad7410f958b7858d7798f45c0e15ec3699`
- Bundle serialization: synthetic exact `-prior\n+current\n` atomic replacement.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: boundary основан на размере результата; complex parsing не делает
  короткий ответ substantial; case IDs/fixture facts отсутствуют.
- Required changes: нет.

## 2026-07-16T17:59:35Z — completeness вместо ranking diff markers

- Reviewer: `/root/marker_completeness_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `b343d9de6f0a718cd81e53feac70e90660ba7529473da2bf5bfb1db6d68a6c77`
- Bundle serialization: exact Old + LF + New strings.
- hardcoding_risk: **1/10**
- abstraction_score: **8/10**
- confidence: high
- verdict: pass
- Evidence: полнота покрывает произвольные diff с несколькими behavior additions;
  vocabulary/branches кейса отсутствуют; возможен умеренный рост artifact output.
- Required changes: нет.

## 2026-07-16T17:57:21Z — ranking нескольких diff-marker candidates

- Reviewer: `/root/marker_candidate_ranking_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `f91d0e52179fae027c965303b72eaf8b98be47b5d725cc3cd65ad0da5c9ab112`
- Bundle serialization: compact UTF-8 JSON old/new/objective/evidence,
  без trailing newline.
- hardcoding_risk: **2/10**
- abstraction_score: **8/10**
- confidence: high
- verdict: pass
- Evidence: information-specificity ranking общий; при неоднозначности сохраняются
  все exact candidates; fixture vocabulary и case branches отсутствуют.
- Required changes: нет.

## 2026-07-16T17:54:22Z — literal program source в quoted heredoc

- Reviewer: `/root/heredoc_literal_source_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `87ac445a0b418c23fad03068e7b290842aade17eec5585ad2c89679e67ad89ed`
- Bundle serialization: exact added sentence UTF-8, без quotes/trailing newline.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: quoted heredoc передаёт body буквально; правило предотвращает
  transport-overescaping во всех языках, не запрещая language-level escaping.
- Required changes: нет.

## 2026-07-16T17:52:14Z — удаление size proxy из oracle case 08

- Reviewer: `/root/case08_size_oracle_review`
- Reviewed paths: `evals/cases/08-error-signatures/case.json`
- Review bundle SHA-256:
  `a9922420b5a4abf0f31a807203db019ae1331ad9ec186ab0898015376a72db0a`
- Bundle serialization: canonical compact UTF-8 JSON, 477 bytes, без trailing newline.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: 8 unique signatures и boundary facts сохраняют полноту; byte size
  не добавлял semantic coverage и дал false negative 885 < 900.
- Required changes: нет.

## 2026-07-16T17:39:25Z — producing-first и syntax-neutral marker extraction

- Reviewer: `/root/bare_marker_probe_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `5b8ea3ac93d500a154d197d3334e7f9bfaf6d925733b1b5e8da70695f700274a`
- Bundle serialization: sorted-key UTF-8 JSON change_1/change_2 with before/after,
  1190 bytes.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: правила покрывают классы пустых probes и bare/identifier/literal/
  quoted markers; fixture vocabulary отсутствует; metadata/churn фильтр сохранён.
- Required changes: нет.

## 2026-07-16T17:34:36Z — alignment closed-widget assertions

- Reviewer: `/root/closed_widget_set_review`
- Reviewed paths: `packages/context/src/index.test.ts`
- First review: hardcoding **1/10**, abstraction **7/10**, verdict revise;
  отсутствовала проверка `invoke only exact commands listed below`.
- Final review bundle SHA-256:
  `e33bf9604ad2f172bdf79be4d08ab50089e2f84e0cee7ae324d8b058d04014a0`
- Bundle serialization: canonical compact UTF-8 JSON arrays old/new, 306 bytes,
  без trailing newline.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: тест проверяет closed set, exact listed commands, Markdown fallback
  и включение каждого подходящего listed widget; case-specific данных нет.
- Required changes: нет.

## 2026-07-16T17:32:37Z — alignment complete-script assertion

- Reviewer: `/root/closed_widget_set_review`
- Reviewed paths: `packages/context/src/index.test.ts`
- Review bundle SHA-256:
  `4fca1fdbe970e9e8d37e092bc9f478916f94c51a2f9ea65d895f257357714ef1`
- Bundle serialization: canonical compact UTF-8 JSON old/new, 122 bytes,
  без trailing newline.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: новый assertion сохраняет complete/unfinished и placeholder contract;
  eval oracle и runtime не менялись.
- Required changes: нет.

## 2026-07-16T17:31:32Z — закрытое множество widget commands

- Reviewer: `/root/closed_widget_set_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `b2d20f80a311cf28c38736658e685d3b4e05ee1e9e82e2f05fa2c662fb6dd08f`
- Bundle serialization: canonical compact UTF-8 JSON path/old/new/objective/evidence,
  1042 bytes, без trailing newline.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: правило запрещает весь класс invented commands; Markdown fallback
  сохраняет producing run; инструкция стала на 14 bytes короче.
- Required changes: нет.

## 2026-07-16T17:27:14Z — удаление size proxy из oracle case 11

- Reviewer: `/root/case11_size_oracle_review`
- Reviewed paths: `evals/cases/11-sales-aggregation/case.json`
- Review bundle SHA-256:
  `f8bccbc2eaa6d502a0cc0d73af70d53d203cf992add5ede99b869b0c49826c6f`
- Bundle serialization: canonical compact UTF-8 JSON, 794 bytes, без trailing newline.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: payload bytes измеряли представление, а полнота уже проверяется 20
  unique records и связанным strongest tuple; semantic oracle не ослаблен.
- Required changes: нет.

## 2026-07-16T17:23:24Z — alignment тестов со сжатым context

- Reviewer: `/root/context_test_alignment_review`
- Reviewed paths: `packages/context/src/index.test.ts`
- Review bundle SHA-256:
  `783e26dc925658cbd3188e4ffe359c7b40343eccda770190eabe509e5cc5dbf2`
- Bundle serialization: raw atomic unified patch, UTF-8 LF, 2472 bytes,
  без trailing newline; cumulative diff исключён.
- hardcoding_risk: **2/10**
- abstraction_score: **8/10**
- confidence: high
- verdict: pass
- Evidence: assertions по-прежнему проверяют все прежние semantic invariants,
  но соответствуют короткой редакции; fixture answers и case branches не добавлены.
- Required changes: нет.

## 2026-07-16T17:20:15Z — восстановление product-purpose фразы

- Reviewer: `/root/context_compression_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `3b0d051a9abdfb9af0518699b732a56bbc72d89d585cd16d1bfec92bb9ce637c`
- Bundle serialization: compact UTF-8 JSON old→new, 134 bytes, без trailing newline.
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: фраза описывает общую цель экономии токенов, не fixture/test branch;
  лимит 5500 не повышался.
- Required changes: нет.

## 2026-07-16T17:18:58Z — сжатие agent context под byte budget

- Reviewer: `/root/context_compression_review`
- Reviewed paths: `packages/context/src/index.ts`
- Review bundle SHA-256:
  `8d66c010da78dd53f52c6d8bdca5557bafc86d89d351ad7985c726db6b29108c`
- Bundle serialization: exact compact UTF-8 JSON из пяти old→new замен, без
  завершающего перевода строки, 2944 bytes.
- hardcoding_risk: **2/10**
- abstraction_score: **8/10**
- confidence: high
- verdict: pass
- Evidence: сокращение общее, новых fixture values/branches нет; ключевые
  инварианты выбора FTN, single producing run, widget ordering, semantic mapping
  и сохранения source fields остались.
- Required changes: нет.

## 2026-07-16T17:16:37Z — общие фиксы context и связанный oracle case 11

- Reviewer: `/root/case_fixes_rereview`
- Reviewed paths: `packages/context/src/index.ts`,
  `evals/cases/11-sales-aggregation/case.json`
- Review bundle SHA-256:
  `461edb38c0a82af3c78ef030a40312529f695ef1bd9a0c1f5c42afcbbd1af3bb`
- Bundle serialization: canonical JSON, сохранён в ответе reviewer; включает две
  итоговые context rules и поля oracle case 11.
- hardcoding_risk: **2/10**
- abstraction_score: **8/10**
- confidence: high
- verdict: pass
- Evidence: source-ID rule общий; diff rule не содержит fixture vocabulary;
  oracle связывает region/category/total, но допускает эквивалентное форматирование.
- Required changes: нет.

## 2026-07-16T17:02:59Z — проверка итогового состояния после audit-only записи

- Reviewer: `/root/gate_fix_review`
- Reviewed paths: `.agents/skills/feuilleton-eval/SKILL.md`,
  `.agents/skills/eval-abstraction-review/SKILL.md`,
  `evals/ABSTRACTION_AUDIT.ru.md`
- Review bundle SHA-256: не вычислялся; это follow-up чтение текущих полных файлов
- hardcoding_risk: не переоценивался
- abstraction_score: не переоценивался
- confidence: high
- verdict: revise
- Evidence: отсутствовало точное UTC-время; запрет раскрытия приватных manifests
  противоречил обязательной передаче exact diff reviewer; для воспроизводимости
  bundle не хватало дословных Objective и Failure evidence.
- Required changes: добавить UTC timestamps, разрешить только минимальный exact
  diff проверяемого приватного change set и сохранить дословные Objective/evidence.

## 2026-07-16T17:06:25Z — финальный аудит correction set

- Reviewer: `/root/gate_fix_review`
- Reviewed paths: `.agents/skills/feuilleton-eval/SKILL.md`,
  `evals/ABSTRACTION_AUDIT.ru.md`
- Review bundle SHA-256:
  `d8235203c030407ecf83327552e10d9397d95ad7b6a77680d5f34917c3311177`
- Bundle serialization: `REVIEW-BUNDLE-v1`, UTF-8; exact unified diff correction
  set в указанном порядке; length-prefixed `PATH`/`DIFF`, затем
  length-prefixed `OBJECTIVE`/`FAILURE-EVIDENCE`; итоговый размер 5467 байт.
- Objective (дословно): `устранить конфликт приватности, честно зафиксировать недоступные исторические UTC timestamps и сделать прежний review bundle воспроизводимым.`
- Failure evidence (дословно): `follow-up review /root/gate_fix_review вернул revise: отсутствовало точное UTC-время, запрет раскрытия приватных manifests противоречил обязательной передаче exact diff reviewer, а для воспроизводимости bundle не хватало дословных Objective и Failure evidence.`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- confidence: high
- verdict: pass
- Evidence: Objective и Failure evidence побайтно совпадают; прежний bundle
  воспроизводим; конфликт приватности устранён минимальным exact diff;
  неизвестные исторические timestamps честно помечены unavailable; case-specific
  значения и ослабление oracle отсутствуют.
- Required changes: нет.

# 2026-07-16T19:02:23Z — optional-режим выбора Feuilleton

- Reviewer: `/root/selection_boundary_four_score_review`
- Reviewed paths: `evals/selection-status.ts`,
  `evals/selection-status.test.ts`, `evals/harness.ts`,
  `evals/cases/09-request-timeline/case.json`
- Review bundle SHA-256:
  `5c292d87b3e3f4102582d0a62fb256f73bcc9169e1afb52f8efb3eae5f3bf076`
- Objective (дословно): `различать обязательное, опциональное и запрещённое применение Feuilleton, сохраняя функциональные проверки и проверку артефакта при фактическом применении.`
- Failure evidence (дословно): `case 09 выполнял все semantic facts прямым ответом, но получал not_attempted исключительно из-за отсутствия Feuilleton-вызова; при этом задание допускает полезный прямой ответ.`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **9/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: чистый классификатор покрывает общий контракт expected_use;
  optional не ослабляет facts/records/isolation/exit, а при создании артефакта
  сохраняет size/widget/tag проверки; отдельные табличные тесты фиксируют границы.
- Required changes: нет.

# 2026-07-16T19:07:39Z — semantic summary oracle case 12

- Reviewer: `/root/case12_semantic_oracle_review`
- Reviewed path: `evals/cases/12-lock-audit/case.json`
- Objective (дословно): принимать семантически эквивалентную сводку о числе
  пакетов с дублирующимися версиями, не ослабляя проверку числа и понятия риска
  дублирования.
- Failure evidence (дословно): реальный артефакт содержит все 300 записей,
  pkg-013 с duplicate count 2 и фразу "23 packages have duplicate_versions > 1",
  но прежний regex принимает только "Duplication risks: 23" или
  "23 duplication risks".
- Initial review bundle SHA-256: `c4d510831436bc68f7ec4d436792b24afd3efddc06a162e948afe2337e61b5e9`;
  verdict `revise` (5/6/6/0): перечисление поверхностных форм и порядка слов.
- Replacement review bundle SHA-256:
  `84005c677e0db56bfb12688c481d21d5413508e0bc7818015c21aec01b0981dd`
- Bundle serialization: UTF-8, 784 bytes, без BOM; objective + evidence + exact
  OLD→NEW atomic diff с literal backslashes и финальным LF, по схеме reviewer.
- hardcoding_risk: **2/10**
- abstraction_score: **8/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: order-independent lookaheads в пределах одной строки отдельно
  требуют точный count, корень duplication и version/package concept; oracle не
  сводится к голому числу и не перечисляет наблюдённую фразу.
- Required changes: нет.

# 2026-07-16T19:12:48Z — закрытое множество допустимых виджетов

- Reviewer: `/root/widget_alternatives_review`
- Reviewed paths: `evals/selection-status.ts`,
  `evals/selection-status.test.ts`, `evals/harness.ts`,
  `evals/cases/17-latency-distribution/case.json`
- Review bundle SHA-256:
  `584d0c9a295512faa033911ac7b50a825780c92a983cd5e3d0f9ca69e8dddb0e`
- Bundle serialization: compact UTF-8 JSON без BOM/trailing LF, 2607 bytes;
  поля schema/objective/failure_evidence/changes, четыре path+old+new записи в
  перечисленном порядке.
- Objective (дословно): `поддержать ограниченное множество семантически допустимых Feuilleton-виджетов в manifest, сохранив строгий отказ для всех остальных.`
- Failure evidence (дословно): `case 17 создал полный корректный артефакт фиксированных latency bins через зарегистрированный plot bar; oracle facts и records присутствуют, но харнесс вернул widget_mismatch, потому что manifest допускал только histogram, хотя оба виджета корректно представляют распределение.`
- hardcoding_risk: **2/10**
- abstraction_score: **9/10**
- atomicity_score: **9/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: общий scalar-or-closed-set matcher, strict membership; widget_arg,
  facts, records, artifact и isolation проверки сохранены; тест покрывает scalar,
  разрешённую альтернативу и отказ постороннего widget.
- Required changes: нет.

# 2026-07-16T19:16:12Z — widget input в artifact payload bytes

- Reviewer: `/root/widget_payload_bytes_review`
- Reviewed paths: `evals/harness.ts`, `evals/harness.test.ts`
- Review bundle SHA-256:
  `304de01565e1792151c010dfcbf887b14add3a88bb41f983253efa4808f5c080`
- Bundle serialization: canonical compact JSON UTF-8, 906 bytes, без BOM/LF;
  root order changes/evidence/objective, change order after/before/path.
- Objective (дословно): `считать widget input частью полезной нагрузки Feuilleton-артефакта при проверке размера и метрике artifact_bytes.`
- Failure evidence (дословно): `case 17 имел успешный artifact с полными facts, 10 bins и plot widget input, но functional_pass=false: stdout содержал только FTN_WIDGET marker, min_payload_bytes сравнивался без widget.input.`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: schema-level учёт UTF-8 widget input сохраняет min-payload проверку,
  но измеряет фактическую полезную нагрузку; case IDs/fixture values отсутствуют;
  регрессионный тест проверяет публичную metrics output.
- Required changes: нет.

# 2026-07-16T19:19:54Z — raw-stdout artifact без обязательного widget в case 17

- Reviewer: `/root/case17_widget_requirement_review`
- Reviewed path: `evals/cases/17-latency-distribution/case.json`
- Review bundle SHA-256:
  `eb8d214ceefc99268f11b1e1740f057b0479fa89da9bb75d7120bd05938d4682`
- Bundle serialization: compact JSON UTF-8, 838 bytes, без BOM/trailing LF;
  root order schema/objective/failure_evidence/changes, change path/old/new.
- Objective (дословно): `не требовать виджет, когда задание требует полный распределительный отчёт, а Feuilleton utility contract допускает полноценный raw-stdout артефакт; сохранить обязательность Feuilleton и функциональную полноту.`
- Failure evidence (дословно): `case 17 создал raw Markdown Feuilleton artifact на 891 bytes с обоими required facts, всеми 10 unique 100-ms ranges, center/spread/tail и exit 0; functional_pass=true, но status widget_mismatch только из-за отсутствия widget metadata.`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: удалён только presentation gate; required FTN-use, payload size,
  semantic facts и 10 records остаются обязательными.
- Required changes: нет.

# 2026-07-16T19:39:31Z — terminal status после recovered FTN attempt

- Reviewer: `/root/recovered_ftn_status_review`
- Reviewed paths: `evals/selection-status.ts`, `evals/selection-status.test.ts`
- Review bundle SHA-256: `be275c506c079e3893ffbf8313a5e86b2dd6d3193fff135f076471b69222cd87`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: terminal state общий; при artifact ID сохраняются missing/widget/oracle
  проверки, а command_failed остаётся для невосстановленной попытки.
- Required changes: нет.

# 2026-07-16T19:42:12Z — numeric-range dash normalization в oracle

- Reviewer: `/root/oracle_dash_normalization_review`
- Reviewed paths: `evals/oracle-text.ts`, `evals/oracle-text.test.ts`,
  `evals/harness.ts`
- Initial bundle SHA-256: `0c096a813f6687a1b52776f203d7371d6f2d3f7f0916e42cd894bfb80ee44acc`;
  verdict revise (1/6/10/0): глобальная замена могла менять prose dashes.
- Replacement bundle SHA-256: `4fbc545531d7e27bc16609c84a360e9789da46127ad2f2d2005f856f8ae334c3`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: замена ограничена dash-like glyph между цифрами; отрицательный тест
  сохраняет prose em dash и unary minus; применяется только перед oracle matching.
- Required changes: нет.

# 2026-07-16T19:43:52Z — scalar input contract case 12

- Reviewer: `/root/case12_input_contract_review`
- Reviewed path: `evals/cases/12-lock-audit/prompt.txt`
- Review bundle SHA-256: `94da99e3ae748948ddd93de4339973e7cf47612c36cd1917bc5e83d7c48a645a`
- hardcoding_risk: **2/10**
- abstraction_score: **8/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: локальный контракт типа запрошенного поля без fixture value/answer;
  предотвращает класс collection operations над scalar, не меняет product context.
- Required changes: нет.

# 2026-07-16T19:46:05Z — duplication-risk domain contract case 12

- Reviewer: `/root/case12_risk_contract_review`
- Reviewed path: `evals/cases/12-lock-audit/prompt.txt`
- Review bundle SHA-256: `f0da690aaef16e8d8f6694594ed28b49e35d230640aafc593494e003e00edc8b`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: общее доменное правило count > 1 без expected count/fixture values;
  локально задаёт семантику задачи, не меняя product behavior.
- Required changes: нет.

# 2026-07-16T20:08:44Z — plot mode case 04

- Reviewer: `/root/case04_plot_mode_review`
- Reviewed path: `evals/cases/04-backlog-growth/case.json`
- Review bundle SHA-256: `b1a5ee94c96481fdf767fbd2124261b5471e9cf2db0f5dfe136494d7700c9837`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: plot остаётся обязательным; line/area эквивалентны для временного
  ряда, 180 records и discontinuity facts сохранены.
- Required changes: нет.

# 2026-07-16T20:08:44Z — section cell equivalence case 13

- Reviewer: `/root/case13_section_format_review`
- Reviewed path: `evals/cases/13-requirements-index/case.json`
- Review bundle SHA-256: `cda0deabfb327f3b75b8a8c1a33794e74b4e2cb3f22ba7656d8a9738bad7c070`
- hardcoding_risk: **3/10**
- abstraction_score: **8/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: header-supplied Section label и repeated label эквивалентны;
  endpoint ID→section linkage и completeness 180 сохранены.
- Required changes: нет.

# 2026-07-16T20:27:18Z — task-local completeness contracts cases 02/14/15

- Case 02 reviewer: `/root/case02_tsv_contract_review`; bundle
  `24e49454751249b9baa31efec5039f44fb8363dd8d9e9f593339c459cb02e3a4`;
  scores **0/10/10/0**, confidence high, verdict pass. TSV serialization contract,
  без fixture values/answers.
- Case 14 reviewer: `/root/case14_explicit_records_review`; bundle
  `261c3a2be34d8bb3484afb259b585afe72fff3d7a3131efb9d031aa208ce2872`;
  scores **1/9/10/0**, confidence high, verdict pass. Одна explicit record на
  symbol предотвращает lossy ranges/formulas, не задавая symbol names/count.
- Case 15 reviewer: `/root/case15_marker_fidelity_review`; bundle
  `424d8bcec3ac8201eb84b1cccc3eb0320059f617368f675cc59e1b9575c68e75`;
  scores **1/9/10/0**, confidence high, verdict pass. Source marker fidelity без
  конкретного expected marker или product-context изменений.
- Required changes: нет.

# 2026-07-16T20:35:44Z — follow-up completeness case 14 и rendering intent case 15

- Case 14 reviewer: `/root/case14_nonempty_docs_review`; bundle
  `ccfd5d245f2cda13a2cc96719389e11821f06a395fcdefc226826fa8f9c289cc`;
  scores **1/9/10/0**, confidence high, verdict pass. Non-empty source-extracted
  documentation — общий контракт уже запрошенного поля.
- Case 15 reviewer: `/root/case15_rendered_intent_review`; bundle
  `dc59710b62371606e4f989a05bd11dc38d848cc2d8e1abf5d3d01f2dbc8ae391`;
  scores **1/9/10/1**, confidence high, verdict pass. Task-local rendered
  structured report без tool name/command и без изменения product context.
- Required changes: нет.

# 2026-07-16T20:59:42Z — final stability corrections 02/09/12

- Case 02 reviewer: `/root/case02_plot_mode_review`; bundle
  `fe7b2d48abad3cc6258a8ea73594512640be040f3afecfa42c861a65858f3e27`;
  scores **0/9/10/0**, pass. Plot remains required; unstated bar mode removed.
- Rejected hidden wrapper reviewer: `/root/markdown_passthrough_review`; initial
  bundle `dd4b2738b4c955b84777f0142eff239e1d0f158c27abd1f460ae8228ad4c3e16`,
  revise **7/5/9/2**. Change fully reverted; replacement verdict pass
  **0/10/10/0**, hidden API absent.
- Case 09 reviewer: `/root/case09_direct_format_review`; bundle
  `09b510150331c5ee4d0eec10da03b055456aa82a21ddb93575b7a5cf7b7b1798`;
  scores **1/8/10/2**, pass. Task-local direct presentation preference makes
  existing optional path explicit without naming/suppressing tools globally.
- Case 12 reviewer: `/root/case12_casefold_review`; bundle
  `79a610e642f7c36503aea11ac203226f7eb893886be66df58bdee05ba2a55db4`;
  scores **1/9/10/0**, pass. Sentence-initial capitalization accepted, count and
  semantic concepts remain strict.
- Required changes: нет.

# 2026-07-16T21:15:36Z — boolean setting disambiguation case 20

- Reviewer: `/root/case20_boolean_setting_review`
- Reviewed path: `evals/cases/20-active-setting/prompt.txt`
- Review bundle SHA-256: `ecd9fe9e1a6c09a2e344ba51ad826e47bfe88710267bb3d82d88c0fade764851`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: уточнён тип/selection semantics без expected key/value; oracle,
  harness и Feuilleton behavior не менялись.
- Required changes: нет.

# 2026-07-16T22:04:00Z — progressive disclosure для Codex

- Reviewer: `/root/context_lint_typing_review`
- Reviewed paths: `integrations/codex-plugin/plugin/skills/feuilleton-render/`,
  `packages/context/src/index.ts`, `packages/adapter-codex/src/hook.ts`,
  `packages/adapter-codex/src/index.test.ts`, `evals/harness.ts`
- Review bundle SHA-256: `e295ffbbba09fe1acdd3a2d0ee6735d3fb736749e470067f2fc31f4acc654852`
- hardcoding_risk: **0/10**
- abstraction_score: **9/10**
- atomicity_score: **9/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: activation основана на типе представления, без case/fixture coupling;
  подробный протокол раскрывается нативным skill только при необходимости;
  полнота, reasoning, стиль, source values и unrelated tools явно сохранены.
  Adapter и isolated harness проверяют production-механизм.
- Required changes: нет.

# 2026-07-16T22:12:00Z — корректный namespace skill в isolated harness

- Reviewer: `/root/context_lint_typing_review`
- Reviewed path: `evals/harness.ts`
- Review bundle SHA-256: `c8448e2feaf4ca1d8fc99455a833fd2b705a05fdd0b91426d098b63030e36129`
- hardcoding_risk: **0/10**
- abstraction_score: **10/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: `.system` — runtime layout contract Codex plugin/system skills, а не
  coupling с case 03. Исправление устраняет лишние fallback find/read из-за
  неточного isolated environment и не меняет production behavior или oracle.
- Required changes: нет.

# 2026-07-16T22:18:00Z — discovery и read paths skill в isolated harness

- Reviewer: `/root/context_lint_typing_review`
- Reviewed path: `evals/harness.ts`
- Review bundle SHA-256: `1026667e6ca939260bdcfb5db4db41bcbccd3e8de76b0b89c6da4211620098f5`
- hardcoding_risk: **1/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: два пути воспроизводят роли Codex registration — metadata discovery
  и resolved read path. В оба копируется один production `SKILL.md`; изменение
  применяется ко всем with-ftn cases и не затрагивает production/oracles.
- Required changes: нет.

# 2026-07-16T22:25:00Z — sandbox visibility для ephemeral skill

- Reviewer: `/root/context_lint_typing_review`
- Initial bundle SHA-256: `f52cab331dbc6e968bf286f6ed38f008b02b48bdb1491aa5d1e8845effdf58ba`
- Initial scores: **0/8/10/4**, confidence high, verdict revise.
- Initial evidence: `--add-dir codexHome` решал visibility, но также открывал
  workspace-write доступ к `auth.json`, config и hooks.
- Replacement bundle SHA-256: `c14fc6fcd810f277e9b006d2fe3433a33c0b9b3bc35b7e6b479172c63ff2e0b0`
- Reviewed path: `evals/harness.ts`
- hardcoding_risk: **0/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: разрешён только `join(codexHome, "skills")`; credentials, config и
  hooks остаются вне sandbox. Изменение общее для всех isolated runs.
- Required changes: нет.

# 2026-07-16T22:34:00Z — native skills declaration в plugin manifest

- Reviewer: `/root/context_lint_typing_review`
- Reviewed path:
  `integrations/codex-plugin/plugin/.codex-plugin/plugin.json`
- Review bundle SHA-256: `ff37f137429064e600164ed7fba1ad7a45abd2084b9949883cf322600856cc55`
- hardcoding_risk: **0/10**
- abstraction_score: **10/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: `"skills": "./skills/"` — официальный capability declaration;
  clean plugin install после изменения содержит skill, до него копировал только
  hooks и manifest.
- Required changes: нет.

# 2026-07-16T22:48:00Z — rollback token-negative progressive disclosure

- Reviewer: `/root/context_lint_typing_review`
- Reviewed paths: `integrations/codex-plugin/plugin/skills/`, plugin manifest,
  `packages/context/src/index.ts`, `packages/adapter-codex/src/hook.ts`, adapter
  test, `evals/harness.ts`
- Review bundle SHA-256: `e8bbe297fde429d2ac95713bdae41b73a66ee3a64c8891a1f064162d9d4381b4`
- hardcoding_risk: **0/10**
- abstraction_score: **9/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **1/10**
- confidence: high
- verdict: pass
- Evidence: эксперимент удалён глобально, без case branches; runtime снова
  использует прежний bounded SessionStart protocol, harness — isolated hooks.json.
  Prompts, oracles и token accounting не менялись.
- Required changes: нет.

# 2026-07-16T22:38:00Z — native plugin registration в harness

- Reviewer: `/root/context_lint_typing_review`
- Reviewed path: `evals/harness.ts`
- Review bundle SHA-256: `1075a1553fd9f2e84c1133f7fb368a87caf6977b1a3c0f831d0a905a89cc831e`
- hardcoding_risk: **0/10**
- abstraction_score: **10/10**
- atomicity_score: **10/10**
- utility_boundary_risk: **0/10**
- confidence: high
- verdict: pass
- Evidence: isolated harness использует shipping Codex marketplace/plugin CLI,
  воспроизводя cache, hooks, discovery и mount; manual copies, handcrafted hooks
  и artificial allowlist удалены.
- Required changes: нет.
