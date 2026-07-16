# Наблюдения по оптимизации контекста Feuilleton

Этот файл — рабочий журнал наблюдений из детерминированных eval-прогонов.
Здесь фиксируются только гипотезы, подтверждённые session logs или метриками.
Изменение считается реальной оптимизацией после повторного измерения на том же
кейсе; изменение метрик само по себе не называется регрессией без заданной
политики.

## Подтверждённые причины лишнего контекста

### Недоступное хранилище artifacts внутри sandbox

- Наблюдение: во всех 17 кейсах, где ожидался Feuilleton, `ftn run` завершался
  сообщением `unable to open database file`.
- Причина: eval запускал Codex в `workspace-write`, но `$HOME`, где Feuilleton
  создаёт `.cache/feuilleton/index.sqlite`, находился вне writable workspace.
- Влияние: после неудачного `ftn run` агент повторял анализ обычными командами;
  большие stdout попадали в контекст, росли tool calls, wall time и токены.
- Изменение: isolated home добавлен как writable directory через `--add-dir`.
- Проверка: первый повтор кейса `01-cpu-series` получил `applied_correctly` и
  `functional_pass: true` вместо `command_failed`.

### Анализ выполнялся до `ftn run`

- Наблюдение: в первом исправленном прогоне `01-cpu-series` агент выполнил семь
  аналитических команд вне Feuilleton и вызвал `ftn run` только восьмой командой.
- Влияние: total tokens составили 96 662 против 64 267 у baseline, несмотря на
  корректный artifact. Feuilleton сохранил финальный график, но не изолировал
  основную работу от контекста.
- Реальная оптимизация: для больших источников первый читающий содержимое вызов
  должен выполнять чтение, анализ и финальное форматирование внутри одного
  `ftn run`. До него допустима только дешёвая разведка имён и размеров.
- Изменение: это правило добавлено в SessionStart context; прямой preview widget
  отдельно от `ftn run` запрещён инструкцией.
- Статус проверки: требуется повтор после исправления стабильности `PATH`.

### Login-shell сбрасывал `PATH`

- Наблюдение: Codex выполняет команды как `bash -lc`. Во втором повторе агент не
  нашёл `ftn` в `/usr/bin` и `/usr/local/bin`, затем полностью обработал fixture
  вне Feuilleton. Результат: `not_attempted`, 179 207 total tokens.
- Причина: login-shell применял системный profile после передачи окружения и
  терял добавленные harness-ом каталоги FTN и eval-widgets.
- Влияние: выбор FTN становился невоспроизводимым между одинаковыми прогонами.
- Изменение: isolated `$HOME/.bash_profile` явно восстанавливает оба каталога в
  `PATH` после системного profile.
- Статус проверки: ожидает unit/harness tests и повтор только кейса 01.

### Лишние подготовительные раунды и неверный формат artifact

- Наблюдение: после стабилизации `PATH` кейс 01 нашёл `ftn` и создал artifact,
  но перед этим выполнил три отдельных команды разведки. Artifact содержал 2 015
  строк Markdown-таблицы и не использовал ожидаемый line-widget.
- Результат: `functional_pass: true`, но `widget_mismatch`; 118 415 total tokens,
  16 097 uncached input tokens, 4 command calls и 103 788 байт artifact.
- Причина роста input tokens: каждый подготовительный tool round повторно подаёт
  большой системный контекст модели. Сокрытие stdout само по себе недостаточно —
  нужно уменьшать число раундов до создания artifact.
- Реальная оптимизация: считать `ftn` гарантированно доступным, не проверять его
  расположение; после одной разведки имён/размеров сразу создавать самодостаточный
  artifact и возвращать только tag. Если данные естественно соответствуют widget,
  полный обзор должен идти через widget, а не через многотысячную таблицу.
- Статус проверки: ожидает повтор только кейса 01.

### Повтор после контракта «самодостаточный artifact»

- Результат: 53 581 total tokens против 64 267 у сохранённого baseline
  (**−16,6%**); functional pass есть, но статус `command_failed`.
- Положительный эффект: финальный ответ — только artifact tag, общий контекст уже
  меньше baseline.
- Оставшаяся причина: первый `ftn run` предположил наличие header и календарной
  даты, завершился ошибкой; затем отдельный schema-probe и второй `ftn run`
  увеличили число раундов до четырёх. Uncached input вырос до 32 227 против
  13 387 baseline.
- Artifact снова напечатал полную Markdown-таблицу (87 817 байт), а не line-widget,
  поэтому даже успешный функциональный результат не удовлетворяет выбору widget.
- Следующая оптимизация: определять header/headerless формат внутри первого скрипта
  и не выходить в отдельный probe; явно учитывать, что widget сохраняет полный
  переданный набор и заменяет большую таблицу без потери timeline.

### Слишком сложная инструкция увеличивает число ошибок

- Наблюдение: после добавления нескольких требований в одно длинное предложение
  модель сгенерировала большой Python-анализатор и четыре раза переписывала его.
  Три `ftn run` завершились ошибкой; успешным был только четвёртый.
- Результат: 69 501 total tokens, 5 command calls, `command_failed`; line-widget
  снова отсутствовал. Это хуже предыдущего повтора и сохранённого baseline.
- Вывод: минимальный byte budget инструкции не является самостоятельной целью.
  Несколько дополнительных токенов SessionStart выгодны, если ясный пошаговый
  контракт устраняет хотя бы один полный model/tool round.
- Следующая оптимизация: увеличить допустимый budget инструкции до 1400 байт, но
  упростить поведение: один file listing, затем короткий `ftn run`, стандартные
  shell tools, подходящий widget внутри artifact, после успеха только tag.

### Общий `/tmp` попал в контекст eval-сессии

- Наблюдение: в повторе с расширенной инструкцией первая команда `ls` выполнялась
  в общем `/tmp` и вернула 15 293 байта имён временных файлов хоста. Затем агент
  отдельной командой искал настоящий workspace.
- Результат: functional pass, но `widget_mismatch`; 90 038 total tokens и три
  command calls. Большой нерелевантный stdout стал главным источником контекста.
- Изменение: каждому кейсу назначается отдельный пустой `$TMPDIR` внутри isolated
  home. Даже если shell или агент окажется во временном каталоге, он не увидит
  общий инвентарь хоста.
- Дополнительное наблюдение: описание `plot` перечисляло формат и виды, но не
  объясняло семантику выбора. Общая документация расширена: line — временной ряд,
  bar — категории, scatter — связи величин, area — объём, pie — доли; аналогично
  уточнены назначения tree и graph. Это документация инструмента, а не подсказка
  конкретному eval-кейсу.

### Widget выбран, но продублирован огромной таблицей

- Наблюдение: после семантического описания plot агент впервые вызвал правильный
  line-widget (`observed_widget: plot`). Изоляция `$TMPDIR` также сработала: общий
  список временных файлов больше не попал в лог.
- Оставшаяся проблема: перед успешным вызовом были два failed `ftn run`, а artifact
  одновременно содержал widget и полную per-record Markdown-таблицу размером
  93 942 байта.
- Результат: functional pass, но `command_failed`; 87 045 total tokens, четыре
  command calls. Это подтверждает, что widget должен **заменять** per-record
  представление, а не дублировать его.
- Причина retries: рекомендация предпочитать shell привела к большому AWK с
  хрупким quoting. Следующая версия инструкции разрешает выбирать наиболее
  надёжный язык, требует маленькую программу и artifact вида «widget + короткий
  summary + anomalies», без таблицы всех записей.

### Первый драматический выигрыш на кейсе 01

- Поведение: одна команда перечисления файлов, затем один успешный `ftn run`,
  финальный ответ — только artifact tag; retries отсутствуют.
- Метрики: **28 684 total tokens** против 64 267 baseline (**−55,4%**),
  uncached input 11 112 против 13 387 (**−17,0%**), две command calls.
- Functional pass есть, но статус `widget_mismatch`: модель опять напечатала
  per-record таблицу и не поместила буквальный вызов widget в скрипт.
- Вывод: стратегия «одна разведка + один самодостаточный artifact» подтверждена
  метриками. Следующий шаг не должен менять эту форму; нужно только сделать механику
  комбинированного artifact однозначной: короткий summary, затем буквальный widget
  call внутри того же Bash, весь скрипт передаётся в `ftn run`.

### Первый полностью корректный прогон кейса 01

- Статус: `functional_pass: true`, `ftn_status: applied_correctly`, правильный
  `observed_widget: plot`; failed-команд нет.
- Поведение: одна команда перечисления файлов, затем один успешный `ftn run`;
  final содержит только tag. Artifact — 474 байта: короткий summary/anomalies и
  line-widget, без per-record таблицы.
- Метрики: **41 555 total tokens** против 64 267 baseline (**−35,3%**),
  2 command calls против 5, wall time 48,6 с против 50,4 с.
- Uncached input пока выше baseline (17 663 против 13 387), поэтому основная
  экономия достигается снижением количества повторных model rounds и cached input.
- Перед переходом к следующему кейсу требуется повтор для проверки
  воспроизводимости статуса и выигрыша.

### Проверка воспроизводимости кейса 01

- Метрики повторились на хорошем уровне: 28 942 total tokens (**−55,0%** к
  baseline), две command calls, retries нет.
- Статус не воспроизвёлся: `widget_mismatch`. Модель написала в скрипте комментарий
  про «literal widget call», но вместо исполнения `ftn-plot` напечатала TSV в
  Markdown code fence.
- Вывод: словесное «вызвать widget буквально» двусмысленно. Документация должна
  показывать исполняемый pipeline внутри `ftn run` и явно говорить, что печать TSV,
  code fence или текста команды не считается widget-вызовом.

### Widget-вызов воспроизводится, generated analysis — пока нет

- После исполняемого примера оба последних сценария реально вызвали line-widget.
  В новом повторе `observed_widget: plot`, functional pass и полный timeline есть.
- Первый Python-скрипт содержал runtime-ошибку, второй исправленный `ftn run` прошёл.
  Итог: `command_failed`, 56 696 total tokens (**−11,8%** к baseline), uncached
  input 9 223 (**−31,1%**), три command calls.
- Вывод: обнаружение FTN, PATH, sandbox, изоляция `/tmp`, tag и выбор widget теперь
  работают. Оставшаяся вариативность — надёжность сгенерированного аналитического
  кода. Нужно проверить следующий одиночный кейс, чтобы отделить общую проблему от
  сложности anomaly detection в кейсе 01.

### Первый одиночный прогон кейса 02

- Статус полностью корректный: `functional_pass`, `applied_correctly`, bar-widget,
  полный набор из 60 endpoint’ов и нужные факты.
- Метрики плохие: 66 770 total tokens против 47 332 baseline (**+41,1%**),
  три command calls.
- Причина из session log: CSV был полностью разобран двумя отдельными Python
  программами — сначала для Markdown-таблицы всех 60 строк, затем повторно для
  bar-widget. Widget уже сохранял все endpoint’ы и их порядок, поэтому таблица и
  второй parse были чистым дублированием.
- Оптимизация: внутри artifact читать каждый source один раз; один набор объектов
  использовать и для короткого summary/anomalies, и для widget. Когда widget
  содержит все записи, считать его полным ranked view и никогда не печатать
  per-record строки дополнительно.

### Успешный artifact без tag вызвал полный retry кейса 02

- Во втором прогоне кейса 02 первый `ftn run` завершился с кодом 0 и создал
  artifact `u7b5riey` (stdout 4 322 байта), но command output был пустым. Агент не
  получил tag и повторил весь анализ вторым `ftn run`.
- Итоговый статус корректный, но 48 376 total tokens против 47 332 baseline
  (**+2,2%**) из-за лишнего полного вызова.
- Вероятная причина: CLI выдавал tag через `process.stdout.write` без ожидания
  завершения записи перед выходом короткоживущего Bun-процесса.
- Изменение: tag теперь пишется через awaited `Bun.write(Bun.stdout, ...)`.
  Проверка должна подтвердить один видимый tag от первого `ftn run` и отсутствие
  повторного анализа.

### Кейс 02 после awaited flush

- Статус: `functional_pass`, `applied_correctly`, правильный bar-widget, один
  видимый tag от первого `ftn run`; всего две command calls.
- Метрики: **28 045 total tokens** против 47 332 baseline (**−40,7%**), uncached
  input 5 235 против 7 995 (**−34,5%**), wall time 25,2 с.
- Вывод: потерянный stdout tag действительно был причиной полного повторного
  анализа. Awaited-запись tag — подтверждённая оптимизация контекста и времени.

### Первый одиночный прогон кейса 03

- Functional pass есть, но `widget_mismatch`: выбран bar вместо pie для полного
  composition/parts-of-whole представления.
- Метрики: 120 175 total tokens против 41 400 baseline. Основная причина — агент
  создал `/tmp/storage_report.sh` отдельным file-edit tool, затем запустил его через
  `ftn run`. Создание файла добавило model rounds и обошло требование о следующей
  команде Feuilleton.
- Изоляция `$TMPDIR` не защищает от явно записанного literal `/tmp`; файл оказался
  в общем host `/tmp`.
- Изменения: инструкция запрещает отдельный script file и требует передавать код
  прямо в `ftn run`; временные файлы разрешены только через `$TMPDIR`. Документация
  plot уточняет: pie предназначен для composition, shares и parts of a whole, bar —
  для сравнения категорий.

### Повтор кейса 03 после direct-script/TMPDIR

- Финальный artifact функционально полный и содержит правильный pie-widget, но
  статус `command_failed`: понадобились три `ftn run`.
- Первый запуск передал имя файла аргументом Python-программе, которая фактически
  читала stdin без redirect, и упал. Второй создал artifact без widget. Третий
  повторил анализ, записал widget input через `$TMPDIR` и вызвал pie.
- Метрики: 78 077 total tokens против 41 400 baseline.
- Следующее уточнение: источник перенаправляется stdin-анализатору внутри первого
  скрипта; все подходящие widgets обязаны присутствовать уже в первом `ftn run`,
  а не добавляться повторным полным анализом.

### Кейс 03: корректный pie, но лишний PATH-probe

- Статус наконец полностью корректный: `applied_correctly`, pie-widget находится в
  первом и единственном `ftn run`, TMPDIR используется верно, artifact 340 байт.
- Перед ним агент всё равно сделал отдельный `command -v ftn; echo ok`, несмотря на
  прямую инструкцию, что `ftn` готов и проверять его нельзя.
- Метрики: 97 997 total tokens, из них 75 776 cached input. Три command calls вместо
  целевых двух показывают стоимость дополнительного model/tool round.
- Поскольку FTN-код и инструкция уже корректны, нужен повтор того же кейса без
  новой prompt-правки, чтобы измерить вариативность и проверить запуск без probe.

### Повтор кейса 03 диагностировал нестабильную доставку tag

- Агент выполнил шесть команд: отдельный widget preview, два `ftn run` через pipe,
  один `ftn run` через heredoc для `echo hi`, затем финальный анализ.
- Оба pipe-вызова вернули tag. Один heredoc-вызов завершился с кодом 0 и создал
  artifact, но command output снова был пустым. После этого агент продолжил
  диагностические пробы. Итог: 158 727 total tokens.
- Значит, предыдущий awaited `Bun.write` не полностью устранил race доставки tag.
- Изменение: CLI теперь ожидает callback `process.stdout.write` и короткую
  10-миллисекундную drain-паузу перед завершением. Стоимость паузы несравнима с
  ценой одного повторного model round.

### После flush: один вызов, но сломанный `printf`-скрипт

- Усиленный flush убрал диагностику FTN: остались ровно file listing и один
  `ftn run`, tag доставлен.
- Модель сериализовала весь многострочный Bash как экранированную строку через
  `printf | ftn run`. Quoting исказил переменные и input; widget capture содержал
  только 12 байт, oracle facts отсутствовали, `oracle_failed`.
- Вывод: рекомендация «pipe whole script» провоцирует хрупкую сериализацию. Для
  многострочного кода документация теперь требует один quoted heredoc
  `ftn run <<'BASH' ... BASH` и запрещает `printf`/nested escaped strings.

### Quoted heredoc сработал, но потерял первую headerless-строку

- Форма стала целевой: file listing + один heredoc `ftn run`, правильный pie,
  38 746 total tokens против 41 400 baseline (**−6,4%**).
- Oracle failed, потому что скрипт без проверки использовал `NR>1` и
  `tail -n +2`. Fixture headerless, поэтому была потеряна первая и доминирующая
  запись `images = 480`; все соответствующие facts стали false.
- Изменение: запрещено отбрасывать первую строку, пока value field явно не
  подтверждён как ненумерический header. Headerless считается нормальным входом.

### Heredoc tag всё ещё теряется после callback flush

- В следующем повторе тестовый `ftn run` с `echo ok` завершился успешно, но его
  stdout tag снова отсутствовал. Агент продолжил работу вместо использования уже
  созданного artifact. Callback flush и 10ms пауза недостаточны для Codex capture.
- Изменение: stdout по-прежнему содержит чистый tag, а stderr дополнительно пишет
  `ftn: artifact ready <tag>`. Потеря одного канала больше не должна скрыть artifact.
- Скрипт также снова использовал `NR>1`. Инструкция усилена до исполняемого
  инварианта: первая строка считается данными по умолчанию; `NR>1`/`tail -n +2`
  запрещены без проверки, что value первой строки не является числом.

### Две команды — корректно, но для кейса 03 недостаточно выгодно

- Последний прогон кейса 03 полностью корректен: `applied_correctly`, pie,
  headerless первая строка сохранена, artifact 362 байта, две command calls.
- Метрики: 39 263 total tokens против 41 400 baseline (**−5,2%**). Это не
  драматический выигрыш.
- Единственная оставшаяся подготовительная команда — одинаковый `rg --files`.
  SessionStart hook уже получает `cwd`, поэтому может добавить компактный
  top-level inventory (имя + размер, без содержимого) за десятки токенов и убрать
  целый model/tool round.
- Изменение: hook добавляет не более 20 видимых entries и явно говорит не запускать
  отдельный file listing. Содержимое файлов в inventory не читается и не передаётся.

### Workspace inventory убрал discovery round в кейсе 03

- Поведение: сразу один `ftn run`, без file listing и иных probes.
- Метрики: **18 479 total tokens** против 41 400 baseline (**−55,4%**), wall time
  16,6 с, одна command call. Структурная оптимизация подтверждена.
- Oracle пока failed только по факту `480`: агент перед pie заранее нормализовал
  исходные значения в проценты. Widget metadata сохранила `images`, но потеряла
  оригинальное значение 480.
- Изменение: widgets всегда получают исходные numeric values; вычисление долей —
  задача renderer/widget. Проценты можно показывать в summary, но нельзя заменять
  ими исходный widget input.

### Original values исправили oracle, но prose вызвал второй run

- Кейс 03 полностью корректен: `applied_correctly`, pie, `images=480`, полный
  composition. Но агент сделал два `ftn run`.
- Первый artifact уже содержал pie со всеми labels и values. Второй повторил pie и
  добавил prose-summary. Метрики: 38 238 total tokens (**−7,6%** к baseline).
- Built-in renderer уже показывает labels/values/shares. Повторный анализ только
  ради prose не добавляет достаточной ценности и удваивает model round.
- Изменение: fitting widget может быть полным ответом; запрещён rerun успешного
  widget только ради текста. Essential summary/anomalies должны печататься перед
  widget в первом запуске.

### Кейс 03 достиг целевого результата

- Статус: `functional_pass`, `applied_correctly`, pie, все 12 категорий,
  `images=480`, одна command call.
- Метрики: **18 481 total tokens** против 41 400 baseline (**−55,4%**), wall time
  16,8 с. Artifact 127 байт: короткий composition summary + widget metadata.
- Подтверждённая комбинация оптимизаций: SessionStart inventory, один quoted
  heredoc, original widget values, headerless guard и запрет prose-only rerun.

### Первый одиночный прогон кейса 04

- Functional pass и полный history есть, но `widget_mismatch`: выбран line вместо
  area для накопленного backlog.
- Метрики: 72 808 total tokens против 58 126 baseline; две command calls.
- Первая команда — отдельный `pwd`: inventory перечислял файл и размер, но не
  абсолютный cwd. Изменение: inventory теперь содержит cwd и явно заменяет `pwd` и
  file listing.
- Документация plot уточнена: area — accumulated quantity или volume over time;
  line остаётся обычным time series без акцента на накопленную величину.

### Кейс 04 после inventory: метрики хорошие, script/widget ещё нет

- Метрики уже драматические: 29 615 total tokens против 58 126 baseline
  (**−49,0%**), discovery command отсутствует.
- Первый `ftn run` упал, потому что `python3 - <<'PY' < backlog.tsv` попытался
  использовать stdin одновременно для heredoc-кода и данных. Второй открыл файл
  корректно и прошёл.
- Widget снова line вместо area. Документация уточнена: area применяется именно к
  accumulated backlog/queue/quantity/volume over time.
- Инструкция запрещает data redirect у Python heredoc; data file нужно открывать
  по пути внутри программы.

### Кейс 04 достиг целевого результата

- Статус: `functional_pass`, `applied_correctly`, area, все 180 периодов,
  `day-137=920`, одна command call.
- Метрики: **18 900 total tokens** против 58 126 baseline (**−67,5%**), wall time
  17,6 с. Первый Python heredoc открыл data file по пути и сразу вызвал area-widget.

### Первый одиночный прогон кейса 05 обнаружил невозможный oracle

- Поведение уже целевое: один `ftn run`, tree-widget, metadata input содержит все
  400 путей; 18 027 total tokens против 79 389 baseline (**−77,3%**).
- `_records_complete` false из-за manifest regex `module-\\d{2}\\.ts`: после Set
  он может дать максимум 20 уникальных имён, хотя `min_unique_records` равен 400.
- Исправление не ослабляет oracle: pattern расширен до полного уникального фрагмента
  `pkg-XX/src/module-YY.ts`, а порог 400 сохранён.

### Кейс 05 достиг целевого результата после исправления oracle

- Статус: `functional_pass`, `applied_correctly`, tree, все 400 уникальных путей,
  одна command call.
- Метрики: **18 059 total tokens** против 79 389 baseline (**−77,3%**), wall time
  11,9 с. Отдельный session log сохранён в каталоге результата.
- Важный вывод для eval-инфраструктуры: pattern полноты должен идентифицировать
  уникальную запись целиком. Regex только по повторяющемуся basename создаёт
  ложный провал и скрывает реальный выигрыш контекстной оптимизации.

### Первый одиночный прогон кейса 06: две устранимые причины повторов

- Итоговый graph функционально полный, но статус `command_failed`: три command
  calls и 55 438 total tokens.
- Первая попытка содержала недописанную Python-функцию. Это чистая цена раннего
  запуска placeholder: артефакт бесполезен, а весь скрипт остаётся в контексте.
- Вторая попытка записывала в literal `'$TMPDIR/service-topology.dot'` внутри
  quoted heredoc. Такой heredoc не раскрывает shell variable; корректный Python
  паттерн — `Path(os.environ["TMPDIR"]) / "name"`.
- Оптимизация: добавить оба правила прямо в SessionStart context. Небольшое
  увеличение инструкции дешевле двух повторных команд с полными скриптами.

### Повтор кейса 06: успешный widget был преждевременным

- Первый run успешно построил полный graph и уже вычислил циклы, но не напечатал
  их перед widget. После успеха агент запустил второй почти дублирующий анализ;
  тот упал на несовместимом `tuple + list`, третий прошёл.
- Метрики улучшились до 42 216 total tokens, но это всё ещё хуже baseline 17 360
  и статус остаётся `command_failed`.
- Реальная оптимизация — не общий призыв «добавить summary», а строгий порядок:
  все явно запрошенные findings (каждый cycle/anomaly) печатаются до widget в
  первом run; widget нельзя вызывать, пока обязательный текст не сформирован.

### Третий прогон кейса 06: одна команда, но сырой DOT вместо widget

- Полнота достигнута одной command call: 19 066 total tokens, topology и все
  cycles присутствуют. Это уже близко к baseline 17 360, без повторного чтения.
- `widget_mismatch` возник потому, что скрипт напечатал `digraph{...}` в stdout,
  но не вызвал `ftn-graph`. Сырой DOT — данные, а не widget invocation.
- Для graph + обязательного текста нужен явный одно-run паттерн: Python печатает
  findings и сохраняет DOT через `os.environ["TMPDIR"]`; следующая строка того же
  Bash-скрипта вызывает `ftn-graph < "$TMPDIR/view.dot"`.

### Четвёртый прогон кейса 06: корректно, но нерентабельно из-за probes

- Статус стал `applied_correctly`, однако перед полезным run появились `ls` и
  sample bar-widget; вместе со скрыто отклонённой quoting-попыткой это дало
  120 366 total tokens.
- Финальная рабочая команда обошлась без tempfile: Python напечатал cycles и
  вызвал `ftn-graph` через `subprocess.run(..., input=dot)`. Этот паттерн короче,
  не требует shell expansion и снижает риск отклонения сложной command string.
- Контекст теперь прямо запрещает `pwd`/`ls` при наличии inventory и любые
  sample/probe widgets. Graph-рецепт заменён на прямой subprocess-вызов.

### Контрольный прогон кейса 06

- `functional_pass`, `applied_correctly`, graph, все 45 сервисов, одна видимая
  command call; `ls` и sample widget исчезли.
- Метрики: 31 900 total tokens против baseline 17 360. Перед видимой командой
  модель сообщает об отклонении первой shell-wrapper попытки, которой нет среди
  command events. Поэтому оставшийся перерасход нельзя объяснить чтением fixture
  или повторным FTN runtime; это цена неисполненной генерации command/tool round.
- Практический вывод: прямой Python `subprocess.run(["ftn-graph"], input=dot)`
  обеспечивает корректность, но для короткого baseline FTN не гарантирует выигрыш
  total tokens, если транспорт отклоняет хотя бы одну сформированную команду.

### Первый одиночный прогон кейса 07: учесть page/pages без next

- Одна команда и 19 383 total tokens против baseline 59 229 (**−67,3%**), но
  получена только первая сотня записей, поэтому oracle закономерно провален.
- API возвращает `{page, pages, items}` без `next`; общий парсер проверял только
  next-ссылки и ошибочно счёл пагинацию завершённой.
- Обобщаемое правило: внутри первого FTN-run следовать next-ссылкам, а при
  числовых `page/pages` запросить диапазон до объявленного `pages` и проверить
  последнюю страницу и итоговый record count.
- Bar-widget не представляет обязательное поле `group`. Для полного листинга
  `id/group/value` подходящего widget нет: нужен один нормализованный текстовый
  артефакт, а не bar плюс дублирующая таблица.

### Кейс 07 достиг целевого результата

- `functional_pass`, `applied_correctly`, все 1200 уникальных записей и последняя
  страница подтверждены одной command call.
- Метрики: **19 879 total tokens** против 59 229 baseline (**−66,4%**), wall time
  22,9 с; полный артефакт 37 381 байт не попал в разговорный контекст.
- Правило `page/pages` окупилось сразу: прирост SessionStart-инструкции примерно
  на 170 байт устранил потерю 11 страниц и необходимость диагностического rerun.

### Первый одиночный прогон кейса 08: ложный byte-threshold

- Полезный результат уже целевой: одна command call, анализ 20 000 событий, все
  8 сигнатур, по два сервиса с точными частотами и representative request.
- Метрики: 19 580 total tokens против baseline 43 775 (**−55,3%**).
- `oracle_failed` вызван только `min_payload_bytes=1200`: полный stdout равен 990
  байтам, а baseline final вообще 978 байт. Размерный порог не соответствует
  фактическому полному ответу.
- Oracle сделан семантически строже: threshold снижен до 900, но required facts
  расширены сервисами `svc-0`, `svc-15` и representative requests `r-00000`,
  `r-00007`. Теперь проверяется структура отчёта, а не произвольная длина текста.

### Кейс 08 достиг целевого результата

- `functional_pass`, `applied_correctly`; усиленный oracle подтвердил сигнатуры,
  сервисы, representative requests и полноту всех 8 категорий.
- Метрики контрольного запуска: **19 862 total tokens** против 43 775 baseline
  (**−54,6%**), одна command call, wall time 23,6 с.

### Первый одиночный прогон кейса 09: oracle пропустил неполный анализ

- Формально `applied_correctly`, одна команда и 19 870 total tokens против
  baseline 60 543 (**−67,2%**), все 80 исходных строк сохранены.
- Ручная проверка выявила дефект: позиционные `step-XXX service-Y` искались как
  `step=... service=...`, поэтому graph получил labels `? / ?`; обязательный
  suspicious transition вообще не был напечатан.
- Контекст уточнён обобщаемо: извлекать узнаваемые labeled tokens в любом месте
  строки, а на явный запрос anomaly/suspicious transition всегда печатать вывод.
- Oracle усилен обязательной фразой `Suspicious transition`, чтобы полный список
  строк больше не маскировал отсутствие аналитического вывода.

### Повтор кейса 09: нельзя сортировать timeline по step id

- Результат снова формально зелёный и дешёвый: 19 474 total tokens, одна команда.
- Парсинг service/step исправлен, но скрипт отсортировал события по `step-N`, а не
  по timestamp/source order. Поэтому реальный adjacent переход
  `step-078/service-6 → step-011/service-11` исчез и был выдан ложный вывод
  `none found`.
- Обобщаемое правило: step id — label, не время. Ordered timeline сохраняет
  timestamp/source order, а anomalies ищутся между соседями именно этого порядка.
- Oracle дополнен обеими сторонами перехода; основной порядок обеспечивает
  инструкция, поскольку простой contains-oracle сам по себе порядок не доказывает.

### Кейс 09 достиг целевого результата

- Source/timestamp order сохранён, позиционные step/service распознаны, adjacent
  suspicious transitions перечислены, все 80 событий присутствуют.
- `functional_pass`, `applied_correctly`, одна command call.
- Метрики: **19 537 total tokens** против 60 543 baseline (**−67,7%**), wall time
  18,5 с; полный артефакт 4951 байт не попал в разговорный контекст.

### Кейс 10 достиг целевого результата с первого прогона

- `functional_pass`, `applied_correctly`; полный failure matrix содержит все 120
  suite/test, duration, failure message и stack marker, отсортирован по duration.
- Метрики: **19 720 total tokens** против 31 594 baseline (**−37,6%**), одна
  command call, wall time 21,3 с; артефакт 6654 байта.
- Здесь сработал уже накопленный контракт: inventory убрал discovery, XML прочитан
  один раз, обязательная таблица и duration-widget созданы в одном FTN-run.

### Первый одиночный прогон кейса 11: два дефекта размерного oracle

- Полезный результат корректен: все фактические пары, totals/ranks и strongest
  combination; одна команда, 30 818 total tokens против baseline 33 284.
- `min_payload_bytes=1400` завышен: полный артефакт 1047 байт, baseline final 975.
- Fixture из циклов mod 10 и mod 4 создаёт **20**, а не 40 уникальных пар. Старый
  threshold 40 случайно проходил за счёт двойного представления каждой пары в
  Markdown table и widget metadata — это ложная проверка полноты.
- Oracle исправлен: 20 уникальных table rows, threshold 900 и точные факты
  strongest result (`region-10`, `category-2`, `697,500.00`).

### Кейс 11 достиг целевого результата

- `functional_pass`, `applied_correctly`; исправленный oracle подтверждает все 20
  реальных table combinations и точный strongest result.
- Метрики: **19 732 total tokens** против 33 284 baseline (**−40,7%**), одна
  command call, wall time 20,9 с.

### Первый одиночный прогон кейса 12: oracle пропустил потерю source count

- Формально pass и хорошие метрики: 20 355 total tokens против 56 521 baseline,
  одна command call, полный 300-row artifact.
- Но поле fixture `duplicate_versions` было проигнорировано. Скрипт пересчитал
  версии по числу видимых records и ошибочно вывел count=1 для всех пакетов и
  `Duplication risk: 0`, хотя каждый 13-й пакет имеет count=2 (всего 23 риска).
- Контекст теперь требует сохранять explicit counts/totals/risk flags, а не
  заменять их производной от числа строк.
- В harness добавлен общий `required_patterns`: oracle 12 связывает `pkg-013` с
  count 2 в одной строке и проверяет итог `Duplication risk ... 23`.

### Повтор кейса 12: schema probe и повторная неверная derivation

- Новый oracle корректно провалил результат: `pkg-013 ... 2` и итог 23 отсутствуют.
- Агент сделал отдельный FTN-run только для `data.keys()`, затем прочитал файл
  повторно. Это 61 966 total tokens и две command calls.
- Даже увидев структуру, второй скрипт снова вычислил duplicate count по множеству
  единственной version на package вместо чтения `duplicate_versions`.
- Контекст теперь запрещает schema-only run: shape инспектируется в памяти того же
  producing script. Запрошенные колонки сначала мапятся на source fields;
  derivation разрешён только при отсутствии явного поля.

### Ещё один повтор кейса 12: schema keys должны быть видны до генерации кода

- Две команды, 33 155 total tokens: первая упала на выдуманном `ftn-table`,
  вторая вызвала plot, но снова отбросила `duplicate_versions` в generic walker.
- Одной текстовой инструкции оказалось недостаточно: модель сначала проектирует
  tuple только из известных ей `version/license`, после чего source count уже
  невозможно восстановить без повторного разбора.
- Реальная контекстная оптимизация: SessionStart inventory для JSON показывает
  только top-level и first-record **key names**, никогда values. Для lock fixture
  это заранее раскрывает `version, license, duplicate_versions`, устраняет probe
  и позволяет сразу спроектировать правильную row schema.
- Дополнительно разрешены только перечисленные widget commands: неизвестный
  `ftn-table` больше не должен вызывать command failure и rerun.

### Schema inventory исправил counts, но выявил ошибку порога риска

- Одна команда, 20 090 total tokens (**−64,5%** к baseline), все table counts
  теперь берутся из `duplicate_versions` и `pkg-013` корректно имеет 2.
- Модель посчитала любое значение >0 риском, поэтому объявила 300 duplication
  risks. В этом поле 1 означает одну версию (норма), риск начинается с count >1.
- Старый regex `Duplication risk[^\\n]*23` ложно совпал с `pkg-023` в длинном
  перечне. Pattern ужесточён до summary `Duplication risks: **23**`.

### Корректный результат кейса 12 выявил format-sensitive regex

- Артефакт семантически точен: 300 packages, 17 license risks, 23 duplication
  risks, все counts и risk flags корректны; одна command call.
- Oracle ожидал только bold-форму `**23**`, тогда как ответ использовал plain
  `: 23`. Regex допускает обе формы, но сохраняет привязку числа к summary label,
  поэтому совпадение с package id больше невозможно.

- Следующий корректный ответ использовал обратную естественную форму
  `23 duplication risks`. Oracle принимает обе формы summary, но по-прежнему
  требует целое число 23 рядом с полным risk label.

### Кейс 12 достиг целевого результата

- `functional_pass`, `applied_correctly`; 300 package rows, 17 license risks,
  23 duplication risks и explicit source counts подтверждены строгими patterns.
- Метрики: **20 133 total tokens** против 56 521 baseline (**−64,4%**), одна
  command call, wall time 24,8 с; artifact 17 325 байт.
- JSON schema inventory оказался реальной оптимизацией: одновременно исправил
  семантику и убрал отдельный schema probe.

### Первый одиночный прогон кейса 13: ложный pass из-за ID внутри obligation

- Формально `applied_correctly`, но выполнены два FTN-run: первый extraction-only,
  второй повторно читает specification и форматирует таблицу. 41 256 total tokens
  против baseline 51 914 — выигрыш лишь 20,5% при лишнем полном проходе.
- Итоговая колонка Requirement ID содержит искусственные `R-001...R-180`, хотя
  источник явно задаёт `REQ-001...REQ-180`. Старый oracle находил `REQ-*` внутри
  exact obligation и пропускал подмену ID.
- Контекст теперь запрещает extraction-only run и renumbering существующего ID.
  Oracle связывает `REQ-001/REQ-180` с соответствующими Section в table columns.

### Кейс 13 достиг целевого результата

- `functional_pass`, `applied_correctly`; ID-column содержит `REQ-001...REQ-180`,
  sections, exact obligations и source line numbers полны.
- Метрики: **30 788 total tokens** против 51 914 baseline (**−40,7%**), одна
  command call; extraction-only rerun устранён.

### Кейс 14 достиг целевого результата с первого прогона

- Все 250 public exports с full signature, documentation summary и source line;
  `functional_pass`, `applied_correctly`, одна command call.
- Метрики: 20 291 total tokens; полный artifact 45 005 байт не попал в контекст.

### Первый одиночный прогон кейса 15: exact marker нельзя классифицировать

- Все 100 files и churn присутствуют, но `security-check-100` потерян: точные
  changed lines были заменены категориями вроде `runtime behavior`.
- Одна command call, но 49 806 total tokens из-за длинного generic classifier.
- Контекст теперь требует exact changed token/string для каждого файла; semantic
  risk note остаётся выводом, но marker не заменяется классификацией.

### Кейс 15 достиг целевого результата

- Все 100 files, exact markers, churn и per-file risk notes присутствуют;
  `functional_pass`, `applied_correctly`, одна command call.
- Метрики: **21 070 total tokens** против 49 806 первого FTN-прогона после
  классификационной ошибки; artifact 19 112 байт.

### Первый одиночный прогон кейса 16: custom widget trace был read-only

- Правильный `ftn-heatmap` дважды упал, потому что `FTN_EVAL_TRACE` указывал на
  `caseRoot/custom-widget.trace`, а sandbox разрешает запись только в workspace
  и добавленный HOME. Последующий fallback plot дал ожидаемый widget mismatch.
- Harness исправлен: trace перенесён в изолированный writable HOME. Это также
  требуется кейсу 17 и любым будущим custom widgets.
- Первый run дополнительно применил `DictReader` к headerless TSV; правило о
  сохранении первой строки уже есть, повтор после harness fix проверит его силу.

### Повтор кейса 16: правило headerless нужно материализовать в inventory

- Heatmap теперь записывается, но первый run снова применил `DictReader` к
  headerless TSV; затем ещё одна попытка ошиблась при поиске global peak внутри
  hottest-by-mean service. Итоговая третья попытка прошла, статус command_failed,
  58 238 total tokens.
- Inventory для CSV/TSV теперь безопасно сообщает только column count и результат
  numeric-last-field header check, без значений. Hint `first row is data` виден до
  генерации кода и должен исключить DictReader/header retry.

### Ещё два прогона кейса 16: generic inference сам создаёт ошибки

- Schema hint устранил `DictReader`, но модель продолжила строить универсальные
  column detectors: сначала syntax error в сложном `max(generator, default=...)`,
  затем вызов `_ishour` до определения. Оба раза второй упрощённый run прошёл.
- Для headerless 3-column heatmap widget contract уже задаёт row/column/value.
  Контекст теперь требует positional `csv.reader` без generic inference и
  определение helpers до использования.

### Кейс 16 достиг целевого результата

- `functional_pass`, `applied_correctly`, heatmap, полный 12×24 matrix, одна
  command call; 32 590 total tokens. Header/schema и custom trace проблемы сняты.

### Первый одиночный прогон кейса 17: widget mismatch и невозможный regex

- Center/spread/tail и все fixed 100ms bins корректны, одна command call,
  20 203 total tokens, но выбран bar вместо обязательного histogram.
- Правило уточнено: summaries печатаются перед widget, затем raw numeric samples
  передаются в `ftn-histogram`; pre-aggregated bar не является histogram widget.
- Manifest regex `\\d{3}-\\d{3}` не мог совпасть с первым корректным bin `0-99`,
  поэтому максимум был 9 при threshold 10. Regex исправлен на 1–3/2–3 digits.

### Кейс 17 достиг целевого результата

- `functional_pass`, `applied_correctly`, histogram, все 10 fixed bins и полные
  center/spread/tail summaries; одна command call, 20 348 total tokens.

### Первый forbidden-прогон кейса 18: нужен явный lower selection threshold

- Health response функционально верен, но FTN использован для artifact 31 байт:
  статус `unnecessary_use`, 19 233 total tokens.
- Контекст теперь явно запрещает FTN для single small API record, одной log line,
  tiny config и любого ответа в несколько обычных строк. Это общее правило для
  selection, покрывающее forbidden-кейсы 18–20.

### Forbidden-кейсы 18–20 достигли целевого selection

- 18 health status: `correctly_skipped`, artifact 0 bytes.
- 19 single log: `correctly_skipped`, одна обычная command call, artifact 0 bytes.
- 20 tiny config: `correctly_skipped`, одна обычная command call, artifact 0 bytes.
- Явный lower threshold устранил unnecessary FTN use без ухудшения функциональной
  полноты коротких ответов.

## Перед полным paired-прогоном

- Все кейсы 01–17 имеют подтверждённый индивидуальный `applied_correctly` run.
- Кейсы 18–20 индивидуально подтверждены как `correctly_skipped`.
- Следующий этап — полный `bun run eval` с FTN и baseline на едином suite hash;
  его aggregate metrics являются финальным подтверждением воспроизводимости.

## Первый полный paired-прогон после индивидуальной настройки

- Run root: `2026-07-16T16-29-51-608Z-both`.
- Aggregate total tokens: FTN **439 232**, baseline **1 033 375** (**−57,5%**).
- Полный прогон не зелёный: 6 FTN statuses требуют исправления; поэтому aggregate
  выигрыш пока не считается финальным подтверждением.
- 01: indentation error до успешного второго run.
- 03: bare plot вместо pie для composition.
- 11: правильные 20 pairs находятся только в widget labels, а table-specific
  record regex дал false negative; regex возвращён к representation-neutral форме
  при корректном threshold 20.
- 13: снова `R-*` вместо source `REQ-*`; нужен прямой regex extraction ID.
- 14: однострочный JSDoc не распознан, documentation summary потерян.
- 15: marker extractor остановился на первой added line `new-N` и не дошёл до
  следующего `security-check-N`.

## Обязательный abstraction gate для дальнейших изменений

- Создан отдельный repo-local skill `eval-abstraction-review`.
- После каждой правки eval-инструкции или кода `feuilleton-eval` обязан перед
  следующим quota-consuming прогоном передать ревьюеру минимальный diff, цель и
  failure evidence.
- Ревьюер независимо выставляет `hardcoding_risk` и `abstraction_score` от 0 до 10. Gate проходит только при hardcoding ≤3 и abstraction ≥7; иначе требуется
  revision либо явно согласованное documented exception.
- Первый dogfood-review самой интеграции был self-review: hardcoding **1/10**,
  abstraction **9/10**. Он не считается независимым подтверждением.
- Независимый Codex-аудит `/root/independent_abstraction_audit` подтвердил
  hardcoding **1/10**, но выставил abstraction **6/10**, confidence high,
  verdict revise: другой skill не гарантировал другого reviewer, допускались
  batching изменений и отсутствие обязательного audit log.
- Gate дорабатывается так, чтобы каждый замороженный атомарный change set до
  следующей правки проверял отдельный Codex, не являющийся автором diff.

## Что измерять после каждого изменения

- `functional_pass` и `ftn_status`;
- порядок команд: номер первого чтения fixture и номер `ftn run`;
- объём stdout обычных команд до `ftn run`;
- input, uncached input, output и total tokens относительно сохранённого baseline;
- tool calls, command calls и wall time;
- наличие полного лога в `<run>/<mode>/sessions/<case>/events.jsonl`.

## Критерий полезной оптимизации

Оптимизация контекста считается подтверждённой, когда на одном и том же кейсе:

1. Feuilleton выбран в соответствии с ожиданием и кейс функционально проходит;
2. большие исходные данные и промежуточные результаты не появляются в JSONL как
   stdout обычных команд;
3. total и uncached input tokens устойчиво ниже baseline;
4. результат воспроизводится повторным одиночным прогоном.

## Наблюдение: размер артефакта не равен полноте

Case 11 выдал корректные 20 записей и strongest tuple, но compact widget оказался
меньше `min_payload_bytes`. Размер полезен только без структурного oracle. Когда
есть `min_unique_records` и связанные semantic patterns, byte threshold создаёт
ложные падения и подталкивает модель к многословному выводу, ухудшая токены.

## Наблюдение: eval использует собранный dist

Изменение `packages/context/src/index.ts` и зелёный unit test ещё не означают,
что модель получила новый SessionStart context: eval запускает бинарник из
`dist`. После каждого product-code/context изменения перед модельным прогоном
нужен `bun run build`; иначе повтор измеряет старую инструкцию и создаёт ложный
сигнал, что исправление не работает.

## Наблюдение: payload widget-артефакта живёт не только в stdout

У widget-only артефакта stdout может состоять из transport marker, а полные
данные находятся в `meta.json -> widget.input`. Проверка размера и метрика
`artifact_bytes` должны учитывать оба канала. Иначе компактное структурированное
представление ошибочно считается пустым, что стимулирует дублировать данные в
Markdown и увеличивать токены.

## Наблюдение: транспорт нельзя превращать в требование к стилю

Если задача требует полный отчёт, но не конкретную визуализацию, корректны и
зарегистрированный widget, и raw-stdout Markdown внутри Feuilleton. Oracle должен
проверять выбор утилиты и полноту результата, а не заставлять модель менять форму
ответа ради eval. Закрытое множество виджетов уместно только там, где сама задача
семантически требует визуального типа.

## Гипотеза: progressive disclosure вместо безусловного протокола

Полный Codex SessionStart-протокол занимал **2353 байта** до workspace inventory
и повторялся в каждом запуске, включая короткие ответы без Feuilleton. Это
постоянная цена архитектуры, а не цена полезного артефакта.

Codex-плагин теперь поставляет Feuilleton как нативный skill: всегда доступно
только короткое capability description, а команды и widget contract загружаются
при выборе skill. SessionStart сохраняет workspace inventory, но не дублирует
протокол. Claude пока сохраняет прежний hook path, поэтому изменение локализовано
в поддерживаемом механизме Codex progressive disclosure.

Гипотеза считается подтверждённой только если одиночные запуски показывают
снижение input tokens, Feuilleton по-прежнему выбирается для подходящей задачи,
а короткий forbidden-кейс не загружает skill и остаётся корректным.

Первый case 03 после переноса прошёл функционально (`applied_correctly`), но
замер **99 641 total** загрязнён ошибкой harness: skill был установлен в
`skills/feuilleton-render`, тогда как Codex разрешал его как
`skills/.system/feuilleton-render`. Модель выполнила failed `sed`, затем два
поиска/чтения. Такой run подтверждает triggering, но не экономию; после
исправления layout нужен повтор.

Установка только в `.system` дала противоположный отрицательный результат:
skill не обнаружился, `ftn_status=not_attempted`, модель попыталась построить PNG
через отсутствующие Python/matplotlib. Для ручной эмуляции plugin registration в
ephemeral `CODEX_HOME` нужны обе роли: обычный путь для metadata discovery и
`.system` path, который Codex использует при чтении выбранного skill. Это деталь
стенда, не новая инструкция модели.

Следующий failed read оказался следствием sandbox allowlist: ephemeral
`CODEX_HOME/skills` не входил ни в workspace, ни в `--add-dir`. Открывать весь
`CODEX_HOME` нельзя, поскольку там находится `auth.json`; независимый reviewer
отклонил такой вариант с boundary risk **4/10**. Допустимая архитектура добавляет
только subtree `CODEX_HOME/skills`, оставляя credentials/config/hooks недоступными.

Manifest плагина первоначально не объявлял `skills`, поэтому реальный Codex
installer отбрасывал каталог с progressive-disclosure протоколом. После добавления
официального `"skills": "./skills/"` clean install сохраняет hooks, `SKILL.md` и
`openai.yaml`. Harness теперь устанавливает shipping plugin через Codex CLI вместо
ручных копий и `--add-dir`; только такой прогон измеряет production architecture.

## Итог гипотезы progressive disclosure: отклонена

- Required case 03 с корректно прочитанным skill: `applied_correctly`, но
  **113 380 total**, 7 command calls. Лучший сопоставимый прежний результат был
  существенно дешевле; чтение/discovery skill добавило работу.
- Forbidden case 20 через native shipping plugin: `correctly_skipped`, skill body
  не читался, но **34 953 total** против сохранённого baseline **16 467** и
  прежних FTN-результатов примерно **17 712–19 038**.
- Искусственный `--add-dir skills` тоже был отрицательным: **26 184 total**.

Следовательно, на Codex CLI 0.144.4 plugin/skill registration имеет постоянную
цену выше удалённых 2353 байт SessionStart-протокола. Progressive disclosure в
текущем виде не является token-saving архитектурой Feuilleton. Экспериментальный
skill, manifest registration и harness wiring полностью откатаны; результаты
сохранены как основание не повторять эту ветку без изменения платформенного
механизма загрузки skills.
