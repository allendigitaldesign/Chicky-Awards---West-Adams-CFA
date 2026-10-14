# West Adams Chicky Awards

A one-page ballot team members open on their phone to vote for the Chicky Awards
at the holiday party. Every ballot lands as a row in a Google Sheet, and a
**Results** tab counts the votes for each award automatically.
There is no database to run: the Google Sheet is the record.

## The rules the ballot enforces

- Voters enter their own first and last name.
- They vote for one teammate in **every** award, by first name and last initial (for example *Jane* + *D*).
- **Stuck Like Glue** is for a duo, so it takes two different people. The pair is counted the same
  whichever order it's entered in ("Ana P. + Sam K." either way round).
- No voting for yourself: a nominee whose first name and last initial match the voter's is rejected
  (including either half of the Stuck Like Glue pair).
- One ballot per person (matched on first + last name, ignoring capitals, accents and extra spaces).
  If a leader deletes someone's row, that person can vote again.
- Optional last day to vote (`VOTING_CLOSES` in `rules.js`). After it, the page says voting has closed.

The awards are listed in [`rules.js`](rules.js):

| Award | Description |
|-------|-------------|
| Perfect Attendance | |
| Best Dressed | Always in complete uniform |
| Sunshine Award | Can brighten anyone's day |
| Nuggets of Positivity Award | Always positive |
| Energizer Bunny | Drinks the most caffeine |
| Stuck Like Glue Award | Two people who are never apart (vote for two) |
| Fastest Breader | |
| Fastest and Most Accurate Bagger | Must be both fast and accurate |
| Moment Maker | Gets along with anyone and everyone |
| ET Award | Volunteers to go home the most |

## How leaders use it

Open the Google Sheet.

- **Ballots** tab: one row per voter.
  `Submitted | Voter First Name | Voter Last Name | <one column per award>`
- **Results** tab: every award with each nominee, their vote count and place, most votes first.
  The winner of each award is highlighted. If two people tie for first, both are highlighted.
  It updates after every ballot.

Names are counted together regardless of capitals or a trailing period, so "jane d" and "Jane D." are
the same person. If two team members share a first name and last initial, their votes will be combined;
check the Ballots tab by hand for that award.

If you delete or fix a ballot by hand, choose **Chicky Awards > Refresh results** from the Sheet's menu
(or run `refreshResults` from the Apps Script editor) to recount.

Keep the Sheet private until the party so the results stay a surprise.

## One-time setup (about 10 minutes)

### 1. Create the Google Sheet and its script

1. Create a new Google Sheet, for example "Chicky Awards 2026".
2. In the Sheet, open **Extensions > Apps Script**.
3. Replace everything in `Code.gs` with the contents of [`apps-script/Code.gs`](apps-script/Code.gs).
4. Click **+** next to Files > **Script**, name it `Rules`, and paste in the contents of [`rules.js`](rules.js).
5. Click the save icon. In the function dropdown at the top choose **setup** and click **Run**.
   Google asks you to authorize the script; allow it. This creates the **Ballots** and **Results** tabs.
   If Google says "This app isn't verified", click **Advanced**, then **Go to (project name)**.
6. Click **Deploy > New deployment**. Click the gear icon, choose **Web app**, then set:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

"Anyone" means anyone with the link can vote, without a Google account.
The Sheet itself stays private to you.

If Extensions > Apps Script shows "page not found", you are probably signed into more than
one Google account. Either open the Sheet in a private/incognito window signed into only the
Sheet owner's account, or create the script at [script.google.com](https://script.google.com)
(New project) and set `SHEET_ID` at the top of `Code.gs` to the ID from the Sheet's address
(`docs.google.com/spreadsheets/d/<ID>/edit`). In that case the Chicky Awards menu won't appear in
the Sheet; run `refreshResults` from the Apps Script editor instead. The Apps Script editor needs a computer.

### 2. Connect the page to the Sheet

Open [`config.js`](config.js) and paste the Web app URL between the quotes:

```js
window.APP_CONFIG = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycb.../exec'
};
```

Until this is filled in, the page runs in practice mode: it checks the rules but saves nothing.

### 3. Put the page online with GitHub Pages

1. In this GitHub repository go to **Settings > Pages**.
2. Under "Build and deployment", choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
3. After a minute the page is live at `https://<your-github-username>.github.io/<repo-name>/`.
   Share that link (or a QR code of it) with the team.

## Changing the awards

All awards and the closing date live in [`rules.js`](rules.js). Each award has an `id` (short, no spaces),
a `name` (shown on the page and used as the Sheet column), an optional `description`, and
`pair: true` if voters should name two people for it.
Set them before voting starts; renaming an award after votes are in starts a new, empty column for it.

After editing `rules.js`:

1. Paste the new version into the `Rules` file in Apps Script.
2. Click **Deploy > Manage deployments**, click the pencil, set Version to **New version**, and Deploy.
   The Web app URL stays the same.
3. Commit the change here so the page picks it up too.

## Testing

```sh
node --test
```
