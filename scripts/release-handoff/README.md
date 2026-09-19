# Kontrola tożsamości przekazania Velmère

Narzędzie lokalne, bez zależności zewnętrznych. Wymaga Python 3.10 lub nowszego. Git jest potrzebny tylko dla jednego niezależnego testu porównującego algorytm drzewa z `git write-tree`.

## Co jest sprawdzane

Oczekiwane sumy SHA-256 z zaufanego kanału wiążą dwa pobrane artefakty CI. Kontrola następnie sprawdza każdy wyeksportowany plik, rozmiar, SHA-256, Git blob i odtworzone drzewo Git. Jawnie zadeklarowane pominięcia pozostają NIEZWERYFIKOWANYMI BAJTOWO pominięciami; nie są uzupełniane ani zastępowane.

Źródła muszą odpowiadać oczekiwanemu drzewu, opcjonalnemu commitowi oraz artefaktowi CI. W CI sprawdzane są identyfikatory przebiegu i branchu, manifest dowodów, hashe logów, źródło każdego wyniku, pojedyncze podsumowanie TAP, wyniki wszystkich top-level przypadków, brak fail/skip/cancel/todo, liczby przypadków, rejestr plików i lista plików w wykonanym poleceniu. Lista nieudanych kontroli musi zgadzać się z deklarowanym wynikiem core gate.

Narzędzie nie uruchamia kodu z archiwów, nie rozpakowuje ich na dysk, nie łączy się z bazą, Stripe ani produkcją. Nie wykonuje ponownie testów produktu. Weryfikuje spójność istniejących dowodów, nie ich niezależność ani poprawność merytoryczną. Nie jest narzędziem podpisywania ani atestacji zewnętrznej.

## Testy narzędzia

Z katalogu głównego repozytorium lub tej paczki:

```bash
python -m unittest discover -s scripts/release-handoff -p 'test_*.py' -v
```

Na Windows polecenie `python` można zastąpić `py -3`. W tej sesji wykonano 36 testów, wszystkie przeszły, bez pominięć. Są to testy walidatora, nie dodatkowe regresje produktu Velmère.

## Sprawdzenie zdalnego Q10 native

Wejściem są dwa oryginalne artefakty CI: `q10-source-ci.zip` i `q10-core-ci.zip`. Nie są dołączone do tego dodatku. Przykład Bash po umieszczeniu ich w katalogu roboczym:

```bash
python scripts/release-handoff/verify_handoff.py \
  --source-artifact q10-source-ci.zip \
  --source-artifact-sha256 0ef1ae284c8913a6449ca4382fbee6332373e18820506089ebca298d675e562c \
  --core-artifact q10-core-ci.zip \
  --core-artifact-sha256 b9ca38503a8cdec73fcaca49d47326e84a5e6033474d33f4e59abe9337fc8ab6 \
  --expected-source-sha 5690d7d6ffe75236b03833f47f00cc018f43a083 \
  --expected-tree-sha 2215bf90abb779d8b04e4b5c1382f62bec727df5 \
  --expected-source-files 4097 \
  --expected-test-count 1023 \
  --expected-test-files 60 \
  --output evidence/new-remote-q10-verification.json
```

Oczekiwany wynik dla tych konkretnych, niezmienionych artefaktów: `VERIFIED_EXPORT_WITH_DECLARED_OMISSIONS`. `releaseApproved` pozostaje `false`, a `releaseStatus` pozostaje `NO_GO`. Kod wyjścia 0 oznacza wyłącznie zgodność przekazania z podanym kontraktem, NIE zgodę na release. Kod 1 oznacza odmowę, kod 2 błąd argumentów lub zapisu wyniku. Istniejący plik wynikowy nie jest nadpisywany.

Dla kolejnego źródła trzeba otrzymać niezależnie jego oczekiwane drzewo i metadane CI. Nie wolno automatycznie skopiować oczekiwanych wartości z kontrolowanej paczki, aby kontrola się zazieleniła. Nazwa branchu, numer passa i liczba testów nie zastępują identyfikacji zawartości.

## Format i ograniczenia

Wspierany format źródeł to eksport CI utworzony przez istniejący `scripts/c14-integration/export-source.py`: zewnętrzny ZIP zawiera dokładnie `SOURCE.zip` i `SOURCE_MANIFEST.json`. Wspierany format dowodów to artefakt core z `IDENTITY.json`, `QUALIFICATION.json`, `TEST_FILES.json`, `CORE_GATE.json`, `EVIDENCE_MANIFEST.json` i powiązanymi logami. Dowolny inny lokalny ZIP nie jest automatycznie konwertowany ani dopuszczany.

Archiwa mają ograniczenia rozmiaru i liczby wpisów. Duplikaty, niekanoniczne ścieżki, zaszyfrowane wpisy, wpisy dowiązań i jawne wpisy katalogów są odrzucane. Ograniczony parser TAP obsługuje format przyjętego, płaskiego zestawu regresji Node. Nie jest uniwersalnym parserem całego standardu TAP.

Samodzielne uruchomienie nie podłącza tego narzędzia do CI ani do produkcyjnej bramki release. Dołączony patch dodaje wyłącznie trzy pliki w `scripts/release-handoff/`. Nie modyfikuje aplikacji, detektorów, SQL, UI, zależności ani istniejących workflowów.
