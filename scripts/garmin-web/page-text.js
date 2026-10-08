// `scripts/dev/b.sh eval scripts/garmin-web/page-text.js --out <file>`: the
// visible text of the page body only (#pageContainer), line breaks kept. The
// app's navigation, which carries the account name and devices, is left out.
(() => {
	const page = document.querySelector("#pageContainer");
	return page ? page.innerText : "NO #pageContainer at " + location.pathname;
})()
