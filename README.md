# DIN_BOT AI — FURIA

## Publikacja na GitHub Pages
Wgraj zawartość tego folderu bezpośrednio do głównego katalogu repozytorium (index.html, app.js, style.css itd.), a w Settings → Pages wybierz branch `main` i folder `/ (root)`.

## Tryby pracy
- Przy starcie FURIA pyta o ONLINE lub OFFLINE.
- ONLINE korzysta z Puter.js i domyślnego modelu czatu. Usługa może poprosić o zalogowanie i zgodę na korzystanie z AI. Dostępność i ewentualne koszty zależą od konta i warunków Puter; sprawdź je przed użyciem.
- OFFLINE dobiera silnik do możliwości urządzenia. Jeśli WebGPU udostępnia co najmniej 32 KB pamięci roboczej, używa WebLLM i modelu `Qwen2-1.5B-Instruct-q4f16_1-MLC`. Jeśli limit jest niższy (np. 16 KB) albo WebGPU nie działa, automatycznie przełącza się na procesor (WASM) i mniejszy model `onnx-community/Qwen3-0.6B-ONNX` w kwantyzacji Q4. Tryb CPU jest wolniejszy, ale omija ograniczenie WebGPU. Pierwsze pobranie silnika i modelu wymaga internetu. Po pełnym załadowaniu modelu można odłączyć internet. Przeglądarka musi zachować dane witryny; nie czyść jej pamięci/cache.

GitHub Pages jest hostingiem statycznym. W tym wariancie nie jest potrzebny własny backend, ponieważ ONLINE obsługuje Puter.js z poziomu przeglądarki.


## Ważne ograniczenie sprzętowe
WebLLM wymaga limitu WebGPU `maxComputeWorkgroupStorageSize` co najmniej 32768 bajtów. Gdy przeglądarka zgłasza 16384 bajty, FURIA omija WebLLM i próbuje uruchomić model przez WASM na CPU. Ten tryb może działać wyraźnie wolniej i wymaga pamięci oraz miejsca na pobranie modelu. Działanie zależy od urządzenia i przeglądarki.


## Przełączanie trybów
Wybór ONLINE/OFFLINE jest dostępny na ekranie startowym i w panelu bocznym. Historia rozmowy pozostaje w bieżącej sesji przy zmianie trybu. Na telefonie przyciski trybu pozostają widoczne w wąskim panelu.
