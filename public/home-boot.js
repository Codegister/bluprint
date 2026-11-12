/**
 * Makes the static signed-out Home form usable before React arrives.
 *
 * This file deliberately has no dependencies. It mirrors the small parts of
 * Landing that the first interaction needs: keep the draft, apply the same
 * minimum length, hand the notes to the auth flow, and navigate to sign-in.
 * React replaces this markup once the app loads and keeps the draft as its
 * initial value.
 */
(function () {
  var DRAFT_KEY = "bluprint:home-draft";
  var PENDING_KEY = "bluprint:pending-notes";
  var MAX_NOTES = 40000;
  var MIN_NOTES = 40;
  var DEFAULT_HINT = "Nothing leaves this page until you build.";

  var form = document.querySelector("#home-shell .home-build");
  var textarea = document.querySelector("#home-notes");
  var hint = document.querySelector("#home-notes-hint");
  var submit = document.querySelector("#home-shell .home-build-row .stage-button");
  if (!form || !textarea) return;

  form.removeAttribute("inert");

  function read(key) {
    try {
      return window.sessionStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function write(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      /* Private mode or a full store: navigation still works. */
    }
  }

  function clear(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      /* Nothing to clean up. */
    }
  }

  var draft = read(DRAFT_KEY);
  if (draft) textarea.value = draft;

  function tooShort(value) {
    var length = value.trim().length;
    return length > 0 && length < MIN_NOTES;
  }

  function update() {
    var short = tooShort(textarea.value);
    if (submit) submit.disabled = short;
    if (hint) {
      hint.textContent = short
        ? "Add a sentence or two before building the set."
        : DEFAULT_HINT;
    }
  }

  textarea.addEventListener("input", function () {
    write(DRAFT_KEY, textarea.value.slice(0, MAX_NOTES));
    update();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var notes = textarea.value.trim();
    if (tooShort(notes)) return;
    if (notes) write(PENDING_KEY, notes.slice(0, MAX_NOTES));
    // The notes now live in the auth handoff; don't refill the form with a
    // stale draft if the visitor comes back.
    clear(DRAFT_KEY);

    var path = window.location.pathname.replace(/index\.html$/, "");
    var base = path.charAt(path.length - 1) === "/" ? path : path + "/";
    window.location.assign(
      base + "auth?returnTo=" + encodeURIComponent("/tutor?new=1"),
    );
  });

  // The static guest link predates React. Carry any typed notes into the same
  // handoff Landing uses before the auth screen takes over.
  var guest = document.querySelector("#home-shell .home-guest");
  if (guest) {
    guest.addEventListener("click", function () {
      var notes = textarea.value.trim();
      if (notes.length >= MIN_NOTES) write(PENDING_KEY, notes.slice(0, MAX_NOTES));
    });
  }

  form.setAttribute("data-home-ready", "true");
  update();
})();
