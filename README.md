# Beast Kai Simulator Release v2

This release fixes the missing data-file issue from the earlier release.

## Why the old release broke
The earlier package only included `site/index.html`, but the app also needs the JSON files inside `site/data/`.

## GitHub Pages setup
1. Create a GitHub repository.
2. Upload all files from this zip.
3. Go to **Settings → Pages**.
4. Set:
   - **Source:** Deploy from branch
   - **Branch:** main
   - **Folder:** /site
5. Save.

## Important
Keep the `site/data/` folder exactly where it is.
