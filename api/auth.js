export default function handler(req, res) {
  const client_id = process.env.GITHUB_CLIENT_ID;
  
  if (!client_id) {
    return res.status(500).send("Error: GITHUB_CLIENT_ID environment variable is not defined.");
  }
  
  // Construct redirect URI dynamically matching the Vercel host
  const redirect_uri = `https://${req.headers.host}/api/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=repo,user&redirect_uri=${encodeURIComponent(redirect_uri)}`;
  
  res.redirect(githubAuthUrl);
}
