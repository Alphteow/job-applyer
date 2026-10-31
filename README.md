# SEEK applications

Selenium applies to SEEK jobs using the resume name and answers in `personal/config.json`. Copy `config.example.json` to get started. That folder is gitignored, along with `.env`, `applications.xlsx`, `output/`, and `.chrome-profile`, so a shared repo does not include your resume, salary, visa note, or application history.

`baseSalary` is a monthly amount. SEEK's salary dropdown is annual, so the script picks the closest option. `noticeMonths` is mapped to the nearest week option (`2` becomes "6 or more weeks"). `experienceYears` is used for every experience question. `visa` and `interest` are pasted into matching free-text questions. `resumeFile` must match the file name already saved on your SEEK profile. Put a copy of that resume in `personal/` if you want it kept out of the repo. `manualApplications` is for jobs you already submitted by hand.

Jobs that leave SEEK, or that ask a required question the config does not cover, are skipped.

## Setup

```bash
npm install
mkdir -p personal
cp config.example.json personal/config.json
```

Edit `personal/config.json` with your own search, resume file name, salary, notice period, visa, and interest.

The first run opens a normal Chrome window. Sign in to SEEK with Google there. Selenium attaches only after that sign-in, which avoids Google's "browser may not be secure" block. The login is saved in `.chrome-profile`.

## Run

```bash
npm test
npm run apply -- --dry-run --max 3
npm run apply -- --target 100
```

`--dry-run` stops on the review page and does not submit. `--max` is how many new applications to send this run. `--target` stops when the tracker reaches that many applied jobs, including ones already sent. Results are appended to `output/applications.log` and `applications.xlsx`. Both stay out of git.
