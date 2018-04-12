var map = {};

document.addEventListener("DOMContentLoaded", function(event) {
  map = L.map('map', { zoomControl: false, attributionControl: false }).setView([37.8, -96], 4);
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
});  var geoJsonLayer = new L.GeoJSON.AJAX("states.geojson", {
  var geoJsonLayer = new L.GeoJSON.AJAX("states.geojson", {
  });
  geoJsonLayer.addTo(map);

