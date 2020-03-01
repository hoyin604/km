var mapReady_is = false;
var docReady_is = false;

function onInitMap() {
  mapReady_is = true;
  if (docReady_is) {
    init();
  }
}
$(document).ready(function() {
  docReady_is = true;
  if (mapReady_is) {
    init();
  }
});

function init() {
  var setting = {
    initSuccess_avgDist: 0.05 //km = 50m
    , zoom: 18
    , minSpeed: 2
    , maxSpeed: 40
    , dummySpeedStart: 16
  };

  var origCoord,origTime = null;
  var lastCoord,lastTime = null;
  var posBuffer, posInfoBuffer = null;

  var dist_total = 0;
  var dummy_speed = 0;
  var watch_id,dummyGoTimer_id = undefined;
  var readyToGetPos_is = false;
  var status = "idle"; // undefined|idle|preparing|ready|running
  var map,route_raw,route_real = null;

  var $body = $("body");
  var $info = $(".info.panel");
  var $digi = $(".distance.panel .digi");
  var $speed = $(".action.panel .speed");
  var $console = $(".console");
  var $start_btn = $(".start.btn");
  var $inc_btn = $(".inc.btn");
  var $dec_btn = $(".dec.btn");
  var $dummygo_btn = $(".dummygo.btn");

  if (navigator.geolocation) {
    resetVar();
    $start_btn.click(onAction);
    initConsolePanel();
    initDummyPlug();
  } else {
    $start_btn.hide();
  }

  function resetVar(updateDisplay_is) {
    origCoord = null;
    origTime = null;
    lastCoord = null;
    lastTime = null;

    if (posBuffer == null) {
      posBuffer = new Buffer(4,1);
    } else {
      posBuffer.reset();
    }
    if (posInfoBuffer == null) {
      posInfoBuffer = new Buffer(10,3);
    } else {
      posInfoBuffer.reset();
    }

    dist_total = 0;
    dummy_speed = setting.dummySpeedStart;
    if (watch_id !== undefined) {
      navigator.geolocation.clearWatch(watch_id);
    }
    watch_id = undefined;
    if (dummyGoTimer_id !== undefined) {
      clearInterval(dummyGoTimer_id);
    }
    dummyGoTimer_id = undefined;
    readyToGetPos_is = false;

    if (updateDisplay_is == true) {
      updateDisplay(0,0);
    }
    if ($start_btn != null) {
      $start_btn.html("Prepare");
    }

  }
  function resetMap() {
    if (route_raw != null && route_real != null) {
      route_raw.setMap(null);
      route_real.setMap(null);
    }
    route_raw = null;
    route_real = null;
  }

  function onAction(ev) {
    if (ev != null) ev.preventDefault();
    if (status == "idle") {
      resetVar(true);
      resetMap();
      status = "preparing";
      readyToGetPos_is = false;
      setTimeout(function(){
        readyToGetPos_is = true;
      }, 2000);
      watch_id = navigator.geolocation.watchPosition(onGetStartLoc, onError);
      $start_btn.html("Preparing...");

    } else if (status == "ready") {

      origTime = new Date();
      lastCoord = origCoord;
      lastTime = new Date(origTime.valueOf());
      dist_total = 0;
      status = "running";
      readyToGetPos_is = false;
      $body.addClass("running");
      setTimeout(function(){
        readyToGetPos_is = true;
      }, 2000);
      watch_id = navigator.geolocation.watchPosition(onGeoLoc, onError, {enableHighAccuracy:true});
      $start_btn.html("Stop");

    } else if (status == "dummy_running" || status == "running" || status == "preparing") {
      resetVar();
      status = "idle";
      $body.removeClass("running");
    }
  }

  function onGetStartLoc(pos) {
    if (status == "preparing" && readyToGetPos_is) {

      if (lastCoord == null) {
        lastCoord = {lat:pos.coords.latitude, lng:pos.coords.longitude};
        var t_date = new Date();
        posBuffer.pushItem({lat:lastCoord.lat, lng:lastCoord.lng, t:t_date.valueOf(), dist:0, speed:0, dir_rad:0});
        initGoogleMap(pos.coords.latitude, pos.coords.longitude);
      } else {
        var t_date = new Date();
        bufferAddPos(pos.coords.latitude, pos.coords.longitude, t_date.valueOf());
        posInfoBuffer.lastItem(function(last_item, buffer_size) {
          console_log("[onGetStartLoc] last_item.dist_avg: " + padNum(last_item.dist_avg, undefined,3));
          if (last_item.dist_avg <= setting.initSuccess_avgDist || buffer_size >= 5) {
            origCoord = {lat:last_item.lat_avg, lng:last_item.lng_avg};
            navigator.geolocation.clearWatch(watch_id)
            watch_id = undefined;
            console_log("[onGetStartLoc.ready] " + padNum(origCoord.lat, undefined,6) + "," + padNum(origCoord.lng, undefined,6) + " buffer_size:" + buffer_size);
            status = "ready";
            $start_btn.html("Ready to Go!");
          }
        });
      }

    }
    addRouteRaw(pos.coords.latitude, pos.coords.longitude);
  }

  function onGeoLoc(pos) {
    addRouteRaw(pos.coords.latitude, pos.coords.longitude);
    if (status == "running" && readyToGetPos_is) {
      var t_date = new Date();
      posInfoBuffer.lastItem(function(posInfoLast_item) {
        posBuffer.lastItem(function(posLast_item) {

          var dDist = dist_km(pos.coords.latitude, pos.coords.longitude, posLast_item.lat, posLast_item.lng);
          var dTime_hr = ((t_date.valueOf() - posLast_item.t) / 1000 / 60 / 60);
          var speed = dDist / dTime_hr;
          console_log("[onGeoLoc] speed:" + padNum(speed,undefined,2));
          var max = (posInfoLast_item.speed_avg < (setting.maxSpeed * 0.66))?(setting.maxSpeed * 0.66):setting.maxSpeed;
          if (speed > setting.minSpeed && speed <= max) {
            bufferAddPos(pos.coords.latitude, pos.coords.longitude, t_date.valueOf());
            posInfoBuffer.lastItem(function(posInfoLast2_item) {
              var dDist2 = dist_km(lastCoord.lat, lastCoord.lng, posInfoLast2_item.lat_avg, posInfoLast2_item.lng_avg);
              dist_total += dDist2;
              updateDisplay(dist_total, speed);
              addRouteReal(posInfoLast2_item.lat_avg, posInfoLast2_item.lng_avg);
              lastCoord = {lat:posInfoLast2_item.lat_avg, lng:posInfoLast2_item.lng_avg};
              lastTime = new Date(t_date.valueOf());

              var console_txt = "[onGeoLoc]";
              console_txt += " " + padNum(dDist2,2,2) + "/" + padNum(dist_total,2,2) + "km";
              console_txt += " accu:" + pos.coords.accuracy;
              console_log(console_txt);
            });
          } else {
            console_log("[onGeoLoc.drop] " + padNum(speed,undefined,2) + "km/hr " + padNum(pos.coords.latitude, undefined,6) + "," + padNum(pos.coords.longitude, undefined,6));
          }

        });
      });

    }
  }

  function updateDisplay(dist, speed) {
    var km_str = padNum(dist,2,2);
    var speed_str = padNum(speed,undefined,2);
    if ($digi != null) {
      if (km_str.substr(0,1) != "") {
        $($digi.get(0)).data("data-val", km_str.substr(0,1));
      } else {
        $($digi.get(0)).data("data-val", "");
      }
      $($digi.get(1)).attr("data-val", km_str.substr(1,1));
      $($digi.get(2)).html(km_str.substr(3,1));
      $($digi.get(3)).html(km_str.substr(4,1));
    }
    $speed.html(speed_str + "km/hr");
  }
  function onError(err) {
    console_log(err);
    navigator.geolocation.clearWatch(watch_id)
    watch_id = undefined;
  }

  function initConsolePanel() {
    $(".info.panel .trigger").click(onAction);
    //$body.addClass("info_panel_show");
    function onAction(ev) {
      if (ev != null) ev.preventDefault();
      if ($body.hasClass("info_panel_show")) {
        $body.removeClass("info_panel_show");
      } else {
        $body.addClass("info_panel_show");
      }
    }
  }

  function initDummyPlug() {
    $dummygo_btn.html("dummy will run on " + dummy_speed + "km/hr");
    $inc_btn.click(function(ev) {
      if (ev != null) ev.preventDefault();
      dummy_speed++;
      if (status == "dummy_running") {
        $dummygo_btn.html("dummy running " + dummy_speed + "km/hr");
      } else {
        $dummygo_btn.html("dummy will run on " + dummy_speed + "km/hr");
      }
    });
    $dec_btn.click(function(ev) {
      if (ev != null) ev.preventDefault();
      dummy_speed--;
      if (status == "dummy_running") {
        $dummygo_btn.html("dummy running " + dummy_speed + "km/hr");
      } else {
        $dummygo_btn.html("dummy will run on " + dummy_speed + "km/hr");
      }
    });
    $dummygo_btn.click(function(ev) {
      if (ev != null) ev.preventDefault();
      if (status != "dummy_running") {
        status = "dummy_running";
        $body.addClass("running");
        dummyGoTimer_id = setInterval(function() {
          dist_total += (dummy_speed / 3600);
          updateDisplay(dist_total, dummy_speed);
        }, 1000);
        $dummygo_btn.html("dummy running " + dummy_speed + "km/hr");
      } else {
        resetVar();
        $body.removeClass("running");
        status = "idle";
        $dummygo_btn.html("dummy will run on " + dummy_speed + "km/hr");
      }
    });
  }

  // googleMap related
  function initGoogleMap(lat, lng) {
    var latlngObj = {"lat": lat, "lng": lng};
    if (map == null) {
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: setting.zoom
        , center: latlngObj
      });
    }
    route_raw = new google.maps.Polyline({
      path: [latlngObj]
      , geodesic: true
      , strokeColor: '#FF0000'
      , strokeOpacity: 1
      , strokeWeight: 1
    });
    route_real = new google.maps.Polyline({
      path: [latlngObj]
      , geodesic: true
      , strokeColor: '#00FF00'
      , strokeOpacity: 0.7
      , strokeWeight: 3
    });
    route_raw.setMap(map);
    route_real.setMap(map);
  }
  function addRouteRaw(lat, lng) {
    if (route_raw != null) {
      var latlng = new google.maps.LatLng(lat, lng);
      //console.log(latlng);
      var p = route_raw.getPath();
      p.push(latlng);
      if (map != null) {
        map.setCenter(latlng);
      }
    }
  }
  function addRouteReal(lat, lng) {
    if (route_real != null) {
      var latlng = new google.maps.LatLng(lat, lng);
      //console.log(latlng);
      var p = route_real.getPath();
      p.push(latlng);
      if (map != null) {
        map.setCenter(latlng);
      }
    }
  }

  // buffer related
  function bufferAddPos(lat, lng, t) { // t in ms date format
    posBuffer.lastItem(function(last_item) {
      var dlat = lat - last_item.lat;
      var dlng = lng - last_item.lng;
      var dt_hr = (t - last_item.t) / 1000 / 60 / 60; //hr
      var dist = dist_km(lat, lng, last_item.lat, last_item.lng);
      var speed = dist / dt_hr; // km/hr
      var dir_rad = Math.atan2(dlat, dlng);
      var new_record = {};
      new_record["lat"] = lat;
      new_record["lng"] = lng;
      new_record["t"] = t;
      new_record["dist"] = dist;
      new_record["speed"] = speed;
      new_record["dir_rad"] = dir_rad;
      var dist_total = 0;
      var lat_total = 0;
      var lng_total = 0;
      var speed_total = 0;
      posBuffer.pushItem(new_record, function(re, c) {
        dist_total += re.dist;
        lat_total += re.lat;
        lng_total += re.lng;
        speed_total += re.speed;
      });
      var c =  posBuffer.getSize();
      var infoItem = {
        "dist_avg":(dist_total / c)
        , "lat_avg":(lat_total / c)
        , "lng_avg":(lng_total / c)
        , "speed_avg":(speed_total / c)
      };
      var console_txt = "[bufferAddPos]";
      console_txt += " dist_avg:" + padNum(infoItem.dist_avg, undefined,3);
      // console_txt += " lat_avg:" + padNum(infoItem.lat_avg, undefined,6);
      // console_txt += " lng_avg:" + padNum(infoItem.lng_avg, undefined,6);
      console_txt += " speed_avg:" + padNum(infoItem.speed_avg, undefined,2);
      console_log(console_txt);
      posInfoBuffer.pushItem(infoItem);
    });
  }

  function console_log(msg) {
    console.log(msg);
    $console.text(msg + "\n" + $console.text());
  }

}


// uitl

function padNum(realNum, i, d, posSign_is) {
  var n = parseInt(Math.abs(realNum), 10);
  var result = "" + n;
  if (i !== undefined) {
    result = ("00000000000000000000" + result).substr(-i,i);
  }
  result = ((realNum < 0)?"-":((posSign_is == true)?"+":"")) + result;
  if (d !== undefined) {
    var decPart = realNum - n;
    result = result + "." + ("00000000000000000000" + ((decPart * Math.pow(10,d)) >> 0)).substr(-d,d);
  }
  return result;
}

function dist_km(lat1, lng1, lat2, lng2) {
  var p = 0.017453292519943295; // Math.PI / 180
  var c = Math.cos;
  var a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lng2 - lng1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}
