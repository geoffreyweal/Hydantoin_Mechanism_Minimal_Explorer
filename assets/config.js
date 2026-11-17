/* Where the Step 2 review is kept, and how collaborators sign in to save it (review.js).

   owner, repo, branch, file: review.json on its own branch of the site's GitHub repository, so that saving does not
   rebuild the site. When the site is served from https://<owner>.github.io/<repo>/ the owner and repo are read from
   the address instead.

   clientId, tokenUrl: sign-in with GitHub, through the main study's GitHub App ("Hydantoin Explorer sign-in", installed
   on this site's repository too) and its sign-in Worker (Hydantoin_Mechanism/mechanisms/source/signin_worker/, see
   README_signin.md there). While either is empty the site offers no sign-in. After changing them, rebuild with
   make_website.py --web-only: that also writes the Worker's address into the page's Content-Security-Policy. */
window.HPM_CONFIG = {
  owner: "geoffreyweal",
  repo: "Hydantoin_Mechanism_Minimal_Explorer",
  branch: "review",
  file: "review.json",
  clientId: "Iv23li7D6gvUidxSzFb9",
  tokenUrl: "https://hme-signin.geoffrey-weal.workers.dev/token"
};
