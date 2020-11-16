const Signer = require("./index");
const http = require("http");
const randomUseragent = require("random-useragent");

(async function main() {
  try {
    var proxy = process.env.PROXY;
    var proxyUser = process.env.PROXY_USER;
    var proxyPass = process.env.PROXY_PASS;
    var signer = new Signer(null, null, null, proxy, proxyUser, proxyPass);

    const server = http
      .createServer()
      .listen(8081)
      .on("listening", function () {
        console.log("TikTok Signature server started");
      });

    // Uncomment if you want to auto-exit this application after a period of time
    // If you use PM2 or Supervisord, it will attempt to open it ( in this way tac token will be refreshed)
    setTimeout(function () {
      server.close(() => {
        console.log("Server shutdown completed.");
        process.exit(1);
      });
    }, 20 * 60 * 1000);

    signer.init(); // !?

    server.on("request", (request, response) => {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', '*');

      if (request.method === 'OPTIONS') {
        response.writeHead(200);
        response.end();
        return;
      }

      if (request.method === "POST" && request.url === "/signature") {
        var url = "";
        request.on("data", function (chunk) {
          url += chunk;
        });

        request.on("end", async function () {
          console.log("Received url: " + url);

          try {
            const verifyFp = await signer.getVerifyFp();
            const token = await signer.sign(url);
            const cookies = await signer.getCookies();
            let output = JSON.stringify({
              userAgent: signer.userAgent,
              signature: token,
              verifyFp: verifyFp,
              cookies: cookies
            });
            response.writeHead(200, {
              "Content-Type": "application/json"
            });
            response.end(output);
            console.log("Sent result: " + output);
          } catch (err) {
            console.log(err);
          }
        });
      } else if (request.url === "/useragent") {
        var userAgent = "";

        request.on("data", function (chunk) {
          userAgent += chunk;
        });

        request.on("end", async function () {
          userAgent = userAgent || randomUseragent.getRandom();
          console.log("New user-agent: " + userAgent);
          try {
            // close old signer
            await signer.close();

            // create new one with received user-agent
            signer = new Signer(userAgent, null, null, proxy);
            await signer.init();

            let output = JSON.stringify({
              userAgent: userAgent,
            });
            response.writeHead(200, {
              "Content-Type": "application/json"
            });
            response.end(output);
            console.log("Sent result: " + output);
          } catch (err) {
            console.log(err);
          }
        });
      } else {
        response.statusCode = 404;
        response.end();
      }
    });

    await signer.close();
  } catch (err) {
    console.error(err);
  }
})();
