# C++ Quiz

A static, dependency-free quiz site built from the C++ notes in `~/Documents/Obsidian Vault/cpp`.

- **Multiple choice** — 161 questions across Memory, Smart pointers, Language, Keywords, STL,
  Concurrency, OS and Tooling (`data/mcq.js`). Each answer shows an explanation and links back to
  the source note (`obsidian://` link).
- **Flashcards** — the 80 open-ended questions from `C++ Systems Quiz.md`, self-graded.
- Progress (per-question right/wrong, "review what I missed") is kept in the browser's localStorage.

## Run

Open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Update

- Flashcards: after editing `C++ Systems Quiz.md`, run `python3 tools/build_flashcards.py`.
- Multiple choice: add entries to `data/mcq.js` (`a` is the index of the correct option; options are
  shuffled at runtime).
