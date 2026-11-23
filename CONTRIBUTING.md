# Contributing

SystemKit is mostly writing, so most contributions are lessons, questions, and review prompts.

1. Follow [docs/content-guide.md](docs/content-guide.md) for voice, lesson structure, and question rules.
2. Check the chapter you changed:

   ```bash
   npm run check:content -- <chapter-id>
   ```

3. Run the tests, on Node 22.6 or newer:

   ```bash
   npm test
   ```

Keep chapter, lesson, and question ids stable, because URLs and saved progress depend on them.
