export default async function handler(req, res) {
  const { code } = req.query;
  const client_id = process.env.GITHUB_CLIENT_ID;
  const client_secret = process.env.GITHUB_CLIENT_SECRET;
  
  if (!code) {
    return res.status(400).send("Error: Missing code parameter from GitHub.");
  }
  if (!client_id || !client_secret) {
    return res.status(500).send("Error: OAuth credentials are not properly configured on server.");
  }
  
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error("GitHub OAuth Error:", data.error_description || data.error);
      return res.status(400).send(`OAuth Error: ${data.error_description || data.error}`);
    }
    
    const token = data.access_token;
    if (!token) {
      return res.status(400).send("Error: No access token returned from GitHub.");
    }
    
    // Render the postMessage script to pass the token back to Decap CMS parent window
    res.setHeader("Content-Type", "text/html");
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Completing Authentication</title>
      </head>
      <body>
        <p style="font-family: monospace; font-size: 12px; color: #333; text-align: center; margin-top: 50px;">
          Authorizing connection with GitHub... Please wait.
        </p>
        <script>
          (function() {
            // Signal to Decap CMS that authorization handshake is beginning
            window.opener.postMessage("authorizing:github", "*");
            
            const message = {
              token: "${token}",
              provider: "github"
            };
            
            // Post access token details back to the parent window
            window.opener.postMessage(
              "authorization:github:success:" + JSON.stringify(message),
              "*"
            );
            
            // Close the OAuth popup window
            window.close();
          })();
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("OAuth execution error:", error);
    res.status(500).send("Internal Server Error during token exchange.");
  }
}
