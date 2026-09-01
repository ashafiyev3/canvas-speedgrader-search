# SpeedGrader Student Search

Canvas SpeedGrader makes you scroll a dropdown of every student in the course to find one person. This adds a search box: type a name, press Enter, jump straight to that student.

It also lets you filter to ungraded students only, which is the difference between scrolling past 250 finished submissions and seeing the 40 you still have to do.

## Features

- Search students by name — matches on any part of the name, and on multiple words in any order (`jo do` finds "Jordan Alex Doe")
- **Ungraded only** filter
- Green check next to students you've already graded
- Keyboard driven: arrow keys to move, Enter to jump, Escape to close
- `/` or `Ctrl+Shift+F` (`Cmd+Shift+F` on Mac) reopens the box

## Requirements

- **Google Chrome** (or another Chromium browser — Edge, Brave, Opera, Arc all work; the manifest is unmodified Manifest V3)
- **Canvas LMS** hosted on `*.instructure.com`. If your school self-hosts on a custom domain, see [Custom Canvas domains](#custom-canvas-domains) below.
- A teacher or TA account with grading access to the course

Firefox and Safari are not supported as-is. Firefox needs small manifest changes; Safari requires repackaging as a Safari Web Extension.

## Installation

There is no Chrome Web Store listing, so you install it as an unpacked extension. This takes about a minute.

1. Download the repo — click **Code → Download ZIP** on GitHub, or `git clone` it.
2. If you downloaded the ZIP, unzip it. **Put the folder somewhere permanent** (Documents, not Downloads). Chrome loads the extension from this folder every time it starts, so if you delete or move it, the extension breaks.
3. Open Chrome and go to `chrome://extensions`
4. Turn on **Developer mode** using the toggle in the top-right corner.
5. Click **Load unpacked** (top-left) and select the folder containing `manifest.json`.
6. Open any SpeedGrader page. The search box appears in the top-right.

Chrome will show a "Disable developer mode extensions" warning on startup. That's expected for unpacked extensions and safe to dismiss.

### Updating

Pull or re-download the files into the same folder, then click the refresh icon on the extension's card at `chrome://extensions`.

## Usage

Open SpeedGrader as normal. The box is in the top-right.

| Action | Key |
| --- | --- |
| Move through results | `↑` / `↓` |
| Go to selected student | `Enter` |
| Hide the box | `Escape` or `×` |
| Reopen the box | `/` or `Ctrl+Shift+F` (`Cmd+Shift+F` on Mac) |

Clicking a name works too.

## Custom Canvas domains

Many universities self-host Canvas at an address like `canvas.university.edu` instead of `university.instructure.com`. The extension won't load on those until you add your domain.

Open `manifest.json` and add your domain to the `matches` list:

```json
"matches": [
  "https://*.instructure.com/courses/*/gradebook/speed_grader*",
  "https://canvas.university.edu/courses/*/gradebook/speed_grader*"
]
```

Then reload the extension at `chrome://extensions`.

## Privacy

The extension requests **no permissions** in its manifest. It is a content script that runs only on SpeedGrader pages.

Student data is read from Canvas's own API (`/api/v1/courses/.../gradeable_students` and `/submissions`) using your existing browser session, exactly as the SpeedGrader page itself does. Nothing is stored, cached, or sent anywhere — no external servers, no analytics, no `chrome.storage`. Close the tab and it's gone.

## Troubleshooting

**The box doesn't appear.** Check the URL is a SpeedGrader page (`/courses/<id>/gradebook/speed_grader?assignment_id=<id>`). If your Canvas is on a custom domain, see above. Otherwise open DevTools (F12) and check the Console for errors.

**No green checkmarks.** Some TA roles can't read the submissions endpoint. Search still works; the graded badges and the ungraded filter just won't be accurate. This fails quietly by design.

**"Couldn't load list."** The API call failed. Open the normal student dropdown once, then press `/` to reopen the box — it falls back to reading the names out of the dropdown.

**Search finds nobody.** Try one word instead of a full name. Canvas sometimes displays names in a different order than you'd type them.

## How it works

`content.js` reads the course and assignment IDs out of the page URL, fetches the gradeable-student roster and submission states from the Canvas REST API, and renders a filtered list. Selecting a student rewrites `student_id` in the URL and navigates — the same thing the dropdown does, minus the scrolling.

For anonymous-grading assignments, it drops the `anonymous_id` parameter and lets Canvas re-resolve it.
