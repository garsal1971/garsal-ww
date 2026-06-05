// weward_capture_token.js
// Cattura token e headers di validate_steps

Java.perform(function () {
    console.log("[*] In ascolto per il token e headers...");

    var tokenCaptured = false;
    var headersCaptured = false;

    try {
        var OkHttpClient = Java.use("okhttp3.OkHttpClient");
        var Buffer = Java.use("okio.Buffer");

        OkHttpClient.newCall.implementation = function (request) {
            var call = this.newCall(request);

            try {
                var url = request.url().toString();

                // Cattura token da qualsiasi richiesta weward.fr
                if (!tokenCaptured && url.indexOf("weward.fr") !== -1) {
                    var authHeader = request.header("Authorization");
                    if (authHeader !== null && authHeader.length > 10) {
                        tokenCaptured = true;
                        console.log("TOKEN:" + authHeader);
                    }
                }

                // Cattura headers completi di validate_steps
                if (!headersCaptured && url.indexOf("validate_steps") !== -1) {
                    headersCaptured = true;
                    var headers = request.headers();
                    var headerCount = headers.size();
                    var headerObj = {};
                    for (var i = 0; i < headerCount; i++) {
                        headerObj[headers.name(i)] = headers.value(i);
                    }
                    // Cattura anche il body
                    var bodyStr = "";
                    try {
                        var body = request.body();
                        if (body !== null) {
                            var buf = Buffer.$new();
                            body.writeTo(buf);
                            bodyStr = buf.readUtf8();
                        }
                    } catch(e) {}
                    console.log("HEADERS:" + JSON.stringify(headerObj));
                    console.log("BODY:" + bodyStr);
                }
            } catch (e) {}

            return call;
        };

        console.log("[+] Hook OkHttp OK");
    } catch (e) {
        console.log("[-] Hook fallito: " + e);
    }
});
