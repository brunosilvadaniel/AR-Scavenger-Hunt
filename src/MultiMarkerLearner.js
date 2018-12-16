import { THREEx } from '../lib/ar';

import {
  Scene,
  WebGLRenderer,
  Color,
  PerspectiveCamera,
  Group,
  Stats,
} from 'three';

import './style.scss';

var renderer = new WebGLRenderer({
  // antialias	: true,
  alpha: true
});

renderer.setClearColor(new Color('lightgrey'), 0)
// renderer.setPixelRatio( 2 );
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.position = 'absolute'
renderer.domElement.style.top = '0px'
renderer.domElement.style.left = '0px'
document.body.appendChild(renderer.domElement);
// array of functions for the rendering loop
let onRenderFcts = [];
// init scene and camera
let scene = new Scene();
//////////////////////////////////////////////////////////////////////////////
//		parse urlOptions
//////////////////////////////////////////////////////////////////////////////

let hasHash = location.search.substring(1) !== '' ? true : false
let urlOptions;
if (hasHash === true) {
  urlOptions = JSON.parse(decodeURIComponent(location.search.substring(1)))
} else {
  urlOptions = {
    backURL: null,
    trackingBackend: 'artookit',
    markerControlsParameters: [],
  }
  alert('no urlOption - should not happen')
}

//////////////////////////////////////////////////////////////////////////////////
//		Initialize a basic camera
//////////////////////////////////////////////////////////////////////////////////
// Create a camera
// if( urlOptions.trackingBackend === 'aruco' ){
let camera = new PerspectiveCamera(42, renderer.domElement.width / renderer.domElement.height, 0.01, 100);
// }
// else if( urlOptions.trackingBackend === 'artoolkit' ){
//     var camera = new THREE.Camera();
// }else console.assert(false)
scene.add(camera);
////////////////////////////////////////////////////////////////////////////////
//          handle arToolkitSource
////////////////////////////////////////////////////////////////////////////////
var arProfile = new THREEx.ArToolkitProfile()
arProfile.sourceWebcam().trackingBackend(urlOptions.trackingBackend)
// .performance('desktop-fast')
// arProfile.sourceVideo(THREEx.ArToolkitContext.baseURL + '../data/videos/headtracking.mp4').kanjiMarker();
// arProfile.sourceImage(THREEx.ArToolkitContext.baseURL + '../data/images/img.jpg').hiroMarker()
if (arProfile.contextParameters.trackingBackend === 'artoolkit') {
  // arProfile.sourceImage(THREEx.ArToolkitContext.baseURL + '../test/data/images/markers-page-ipad.jpg')
  arProfile.sourceImage(THREEx.ArToolkitContext.baseURL + '../test/data/images/markers-page-ipad-640x480.jpg')
  // arProfile.sourceVideo(THREEx.ArToolkitContext.baseURL + '../test/data/videos/markers-page-ipad.mp4')
} else if (arProfile.contextParameters.trackingBackend === 'aruco') {
  arProfile.sourceImage(THREEx.ArToolkitContext.baseURL + 'src/threex/threex-aruco/examples/images/screenshot-marker-aruco.png')
} else console.assert(false);

var arToolkitSource = new THREEx.ArToolkitSource(arProfile.sourceParameters)
arToolkitSource.init(function onReady() {
  onResize()
})

// handle resize
window.addEventListener('resize', function () {
  onResize()
})
function onResize() {
  arToolkitSource.onResizeElement();
  arToolkitSource.copyElementSizeTo(renderer.domElement);
  if (urlOptions.trackingBackend === 'aruco') {
    arToolkitSource.copyElementSizeTo(arToolkitContext.arucoContext.canvas)
    camera.aspect = renderer.domElement.width / renderer.domElement.height;
    camera.updateProjectionMatrix();
  } else if (urlOptions.trackingBackend === 'artoolkit') {
    if (arToolkitContext.arController !== null) {
      arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)
    }
  } else console.assert(false);
}
////////////////////////////////////////////////////////////////////////////////
//          initialize arToolkitContext
////////////////////////////////////////////////////////////////////////////////

// honor urlOptions.trackingBackend
arProfile.contextParameters.trackingBackend = urlOptions.trackingBackend;
// create atToolkitContext
var arToolkitContext = new THREEx.ArToolkitContext(arProfile.contextParameters)
// initialize it
arToolkitContext.init(function onCompleted() {
  // if artoolkit, copy projection matrix to camera
  if (arToolkitContext.parameters.trackingBackend === 'artoolkit') {
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  }
});
// update artoolkit on every frame
onRenderFcts.push(function () {
  if (arToolkitSource.ready === false) return;
  arToolkitContext.update(arToolkitSource.domElement);
});

//////////////////////////////////////////////////////////////////////////////
//		learn
//////////////////////////////////////////////////////////////////////////////
// prepare the parameters
var subMarkersControls = []
urlOptions.markersControlsParameters.forEach(function(
  markerControlsParameters
) {
  // create a markerRoot
  var markerRoot = new Group();
  scene.add(markerRoot)
  // create markerControls for our markerRoot
  var markerControls = new THREEx.ArMarkerControls(
    arToolkitContext,
    markerRoot,
    markerControlsParameters
  );

  // TODO here put a THREEx.ArSmoothedControls behind a flag - could be useful for tunning
  var smoothedControls = null;
  // if (false) {
  //   // build a smoothedControls
  //   var smoothedRoot = new THREE.Group()
  //   scene.add(smoothedRoot)
  //   var smoothedControls = new THREEx.ArSmoothedControls(smoothedRoot)
  //   onRenderFcts.push(function () {
  //     smoothedControls.update(markerRoot)
  //   })
  // }
  // add an helper to visuable each sub-marker
  var markerHelper = new THREEx.ArMarkerHelper(markerControls)
  if (smoothedControls !== null) {
    smoothedControls.object3d.add(markerHelper.object3d)
  } else {
    markerControls.object3d.add(markerHelper.object3d)
  }


  // store it in the parameters
  if (smoothedControls !== null) {
    // TODO put that in the if above
    subMarkersControls.push(smoothedControls)
  } else {
    subMarkersControls.push(markerControls)
  }
})

var multiMarkerLearning = new THREEx.ArMultiMakersLearning(arToolkitContext, subMarkersControls)
// window.multiMarkerLearning = multiMarkerLearning
multiMarkerLearning.enabled = false;

function onRecordStart() {
  // cant be started, if it is already started
  if (multiMarkerLearning.enabled === true) {
    console.log('already started');
    return;
  }
  // reset previously collected statistics
  multiMarkerLearning.resetStats();

  // enabled data collection
  multiMarkerLearning.enabled = true

  // update application status
  updateAppStatus()
}
function onRecordStop() {
  // cant be stopped, if it is alread stopped
  if (multiMarkerLearning.enabled === false) {
    console.log('already stopped')
  }

  // stop the application, if it is started
  if (multiMarkerLearning.enabled === true) {
    // stop data collection
    multiMarkerLearning.enabled = false
    // generate json file and store it
    var jsonString = multiMarkerLearning.toJSON();
    console.log('Writing multiMarkerFile', jsonString);
    localStorage.setItem('ARjsMultiMarkerFile', jsonString);

    // update application status
    updateAppStatus();
  }

  // honor ?url= if present
  if (urlOptions.backURL !== null) {
    setTimeout(function () {
      location.href = urlOptions.backURL;
    }, 1);
  }
}
function onRecordClear() {
  localStorage.removeItem('ARjsMultiMarkerFile')
  updateAppStatus()
}
function updateAppStatus() {
  var multiMarkerFile = localStorage.getItem('ARjsMultiMarkerFile');
  if (multiMarkerFile === null) {
    document.querySelector('#dataStatus').innerHTML = 'none';
  } else {
    var json = JSON.parse(multiMarkerFile)
    var fileAge = Date.now() - new Date(json.meta.createdAt).getTime();
    document.querySelector('#dataStatus').innerHTML = 'present';
    fileAge = fileAge / 1000;

    var deltaMinutes = Math.floor(fileAge / 60)
    var deltaSecond = Math.round(fileAge % 60)

    document.querySelector('#dataStatus').innerHTML = 'present since '
      + String(deltaMinutes).padStart(4)
      + 'm'
      + String(deltaSecond).padStart(2, "0")
      + 's';
  }

  if (multiMarkerLearning.enabled === true) {
    document.querySelector('#appStatus').innerHTML = 'running';
  } else {
    document.querySelector('#appStatus').innerHTML = 'stopped';
  }
  if (multiMarkerLearning.enabled === true) {
    document.querySelector('#recordStartButton').style.display = 'none';
    document.querySelector('#recordStopButton').style.display = 'inherit';
  } else {
    document.querySelector('#recordStartButton').style.display = 'inherit';
    document.querySelector('#recordStopButton').style.display = 'none';
  }
}
window.onRecordStart = onRecordStart;
window.onRecordStop = onRecordStop;
window.onRecordClear = onRecordClear;
window.multiMarkerLearning = multiMarkerLearning;

updateAppStatus()

// global click on renderer.domElement is doing a recordToggle
renderer.domElement.addEventListener('click', function () {
  if (multiMarkerLearning.enabled === false) {
    onRecordStart();
  } else {
    onRecordStop();
  }
});

//////////////////////////////////////////////////////////////////////////////
//		UI for markersStatus
//////////////////////////////////////////////////////////////////////////////
function createUIMarkersStatus() {
  document.querySelector('#markersStatus .labelTrackingBackend').innerHTML = urlOptions.trackingBackend
  multiMarkerLearning.subMarkersControls.forEach(function (subMarkerControls) {
    var container = document.createElement('li')
    container.id = 'markerStatus_' + subMarkerControls.id

    var domElement = document.createElement('span');
    domElement.classList.add('name');
    domElement.innerHTML = subMarkerControls.name() + ' : ';
    container.appendChild(domElement)
    domElement = document.createElement('span');
    domElement.classList.add('status');
    domElement.innerHTML = '0%';
    container.appendChild(domElement)
    document.querySelector('#markersStatus ul').appendChild(container)
  })
}
function updateUIMarkersStatus() {
  //////////////////////////////////////////////////////////////////////////////
  //	update all subMarkersControls
  //////////////////////////////////////////////////////////////////////////////
  multiMarkerLearning.subMarkersControls.forEach(function (subMarkerControls) {
    var container = document.querySelector(
      '#markerStatus_' + subMarkerControls.id + ' .status'
    );
    var confidenceFactor = 0
    if (subMarkerControls.object3d.userData.result !== undefined) {
      confidenceFactor = subMarkerControls.object3d.userData.result.confidenceFactor;
    } else {
      confidenceFactor = 0;
    }
    // compute progress from confidenceFactor
    var progress = Math.min(confidenceFactor, 1);

    // if progress === 1, display a green check character
    if (progress === 1) {
      container.style.color = 'green';
      container.innerHTML = "\u2713";
    } else {
      // if progress < 1, display it as a red percent
      container.style.color = 'red'
      container.innerHTML = (progress * 100).toFixed(1) + '%'
    }
  })

  //////////////////////////////////////////////////////////////////////////////
  //		update globalStatus
  //////////////////////////////////////////////////////////////////////////////
  var nMarkersLearned = 0;
  multiMarkerLearning.subMarkersControls.forEach(function (subMarkerControls) {
    if (subMarkerControls.object3d.userData.result === undefined) return;
    if (subMarkerControls.object3d.userData.result.confidenceFactor < 1) return;
    nMarkersLearned++;
  })
  var domElement = document.querySelector('#markersStatus .globalStatus')
  if (nMarkersLearned === multiMarkerLearning.subMarkersControls.length) {
    domElement.style.color = 'green'
    domElement.innerHTML = 'DONE'
  } else {
    domElement.style.color = 'red'
    domElement.innerHTML = 'in progress'
  }
}

// init markersStatus UI
createUIMarkersStatus();
// update markersStatus 10 time per seconds
setInterval(function () {
  // return
  // compute result
  multiMarkerLearning.computeResult();
  updateUIMarkersStatus();
}, 1000 / 10);
onRecordStart();
//////////////////////////////////////////////////////////////////////////////////
//		render the whole thing on the page
//////////////////////////////////////////////////////////////////////////////////
var stats = new Stats();
// document.body.appendChild( stats.dom );
// render the scene
onRenderFcts.push(function () {
  renderer.render(scene, camera);
  stats.update();
})
// run the rendering loop
var lastTimeMsec = null;
requestAnimationFrame(function animate(nowMsec) {
  // keep looping
  requestAnimationFrame(animate);
  // measure time
  lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60
  var deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
  lastTimeMsec = nowMsec;
  // call each update function
  onRenderFcts.forEach(function (onRenderFct) {
    onRenderFct(deltaMsec / 1000, nowMsec / 1000)
  });
});
