(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CourseRoutes = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function parse(hash) {
    var parts = hash.replace(/^#\/?/, "").split("?");
    var path = parts[0] || "home";
    var params = new URLSearchParams(parts[1] || "");
    return { page: path, trackId: params.get("track") || null, section: params.get("section") || null };
  }
  function trackFor(tracks, id) {
    return tracks.find(function (track) { return track.id === id; }) || null;
  }
  function context(tracks, route) {
    var track = trackFor(tracks, route.trackId);
    return track && track.chapters.includes(route.page) ? track : null;
  }
  function href(id, track, section) {
    var query = [];
    if (track && track.chapters.includes(id)) query.push("track=" + encodeURIComponent(track.id));
    if (section) query.push("section=" + encodeURIComponent(section));
    return "#/" + encodeURIComponent(id) + (query.length ? "?" + query.join("&") : "");
  }
  function neighbors(chapters, track, id) {
    var ids = track ? track.chapters : chapters.map(function (chapter) { return chapter.id; });
    var index = ids.indexOf(id);
    return { previous: index > 0 ? ids[index - 1] : null,
      next: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null };
  }
  function readLast(storage, chapters, tracks) {
    try {
      var last = JSON.parse(storage.getItem("llm-course-last") || "null");
      if (!last || !chapters.some(function (chapter) { return chapter.id === last.chapterId; })) return null;
      var track = context(tracks, { page: last.chapterId, trackId: last.trackId });
      return { chapterId: last.chapterId, trackId: track ? track.id : null };
    } catch (error) { return null; }
  }
  return { parse: parse, trackFor: trackFor, context: context, href: href,
    neighbors: neighbors, readLast: readLast };
});
