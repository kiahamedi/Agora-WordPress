/**
 * Agora Broadcast Client 
 */

// join a channel
function agoraJoinChannel() {
  var token = generateToken(); // rendered on PHP
  var userID = 0; // set to null to auto generate uid on successfull connection

  // set the role
  window.agoraClient.setClientRole(window.agoraCurrentRole, function() {
    AgoraRTC.Logger.info('Client role set as host.');
  }, function(e) {
    AgoraRTC.Logger.error('setClientRole failed', e);
  });
  
  // window.agoraClient.join(token, 'allThingsRTCLiveStream', 0, function(uid) {
  window.agoraClient.join(token, window.channelName, userID, function(uid) {
      createCameraStream(uid, {});
      window.localStreams.uid = uid; // keep track of the stream uid  
      AgoraRTC.Logger.info('User ' + uid + ' joined channel successfully');
  }, function(err) {
      AgoraRTC.Logger.error('[ERROR] : join channel failed', err);
  });
}

// video streams for channel
function createCameraStream(uid, deviceIds) {
  AgoraRTC.Logger.info('Creating stream with sources: ' + JSON.stringify(deviceIds));

  var localStream = AgoraRTC.createStream({
    streamID: uid,
    audio: true,
    video: true,
    screen: false
  });
  localStream.setVideoProfile(window.cameraVideoProfile);

  // The user has granted access to the camera and mic.
  localStream.on("accessAllowed", function() {
    if(window.devices.cameras.length === 0 && window.devices.mics.length === 0) {
      AgoraRTC.Logger.info('[DEBUG] : checking for cameras & mics');
      getCameraDevices();
      getMicDevices();
    }
    AgoraRTC.Logger.info("accessAllowed");
  });
  // The user has denied access to the camera and mic.
  localStream.on("accessDenied", function() {
    AgoraRTC.Logger.warning("accessDenied");
  });

  localStream.init(function() {
    calculateVideoScreenSize();
    AgoraRTC.Logger.info('getUserMedia successfully');
    localStream.play('full-screen-video'); // play the local stream on the main div
    // publish local stream

    if(jQuery.isEmptyObject(window.localStreams.camera.stream)) {
      enableUiControls(localStream); // move after testing
    } else {
      //reset controls
      jQuery("#mic-btn").prop("disabled", false);
      jQuery("#video-btn").prop("disabled", false);
      jQuery("#exit-btn").prop("disabled", false);
    }

    window.agoraClient.publish(localStream, function (err) {
      err && AgoraRTC.Logger.error('[ERROR] : publish local stream error: ' + err);
    });

    window.localStreams.camera.stream = localStream; // keep track of the camera stream for later
  }, function (err) {
    AgoraRTC.Logger.error('[ERROR] : getUserMedia failed', err);
  });
}

function leaveChannel() {

  window.agoraClient.leave(function() {
    AgoraRTC.Logger.info('client leaves channel');
    window.localStreams.camera.stream.stop() // stop the camera stream playback
    window.localStreams.camera.stream.close(); // clean up and close the camera stream
    window.agoraClient.unpublish(window.localStreams.camera.stream); // unpublish the camera stream
    //disable the UI elements
    jQuery('#mic-btn').prop('disabled', true);
    jQuery('#video-btn').prop('disabled', true);
    jQuery('#exit-btn').prop('disabled', true);
    jQuery("#add-rtmp-btn").prop("disabled", true);
    jQuery("#rtmp-config-btn").prop("disabled", true);
  }, function(err) {
    AgoraRTC.Logger.error('client leave failed ', err); //error handling
  });
}

function changeStreamSource (deviceIndex, deviceType) {
  AgoraRTC.Logger.info('Switching stream sources for: ' + deviceType);
  var deviceId;
  var existingStream = false;
  
  if (deviceType === "video") {
    deviceId = window.devices.cameras[deviceIndex].deviceId
  }

  if(deviceType === "audio") {
    deviceId = window.devices.mics[deviceIndex].deviceId;
  }

  window.localStreams.camera.stream.switchDevice(deviceType, deviceId, function(){
    AgoraRTC.Logger.info('successfully switched to new device with id: ' + JSON.stringify(deviceId));
    // set the active device ids
    if(deviceType === "audio") {
      window.localStreams.camera.micId = deviceId;
    } else if (deviceType === "video") {
      window.localStreams.camera.camId = deviceId;
    } else {
      AgoraRTC.Logger.warning("unable to determine deviceType: " + deviceType);
    }
  }, function(){
    AgoraRTC.Logger.error('failed to switch to new device with id: ' + JSON.stringify(deviceId));
  });
}

// helper methods
function getCameraDevices() {
  AgoraRTC.Logger.info("Checking for Camera window.devices.....")
  window.agoraClient.getCameras (function(cameras) {
    window.devices.cameras = cameras; // store cameras array
    cameras.forEach(function(camera, i){
      var name = camera.label.split('(')[0];
      var optionId = 'camera_' + i;
      var deviceId = camera.deviceId;
      if(i === 0 && window.localStreams.camera.camId === ''){
        window.localStreams.camera.camId = deviceId;
      }
      jQuery('#camera-list').append('<a class="dropdown-item" id="' + optionId + '">' + name + '</a>');
    });
    jQuery('#camera-list a').click(function(event) {
      var index = event.target.id.split('_')[1];
      changeStreamSource (index, "video");
    });
  });
}

function getMicDevices() {
  AgoraRTC.Logger.info("Checking for Mic window.devices.....")
  window.agoraClient.getRecordingDevices(function(mics) {
    window.devices.mics = mics; // store mics array
    mics.forEach(function(mic, i){
      var name = mic.label.split('(')[0];
      var optionId = 'mic_' + i;
      var deviceId = mic.deviceId;
      if(i === 0 && window.localStreams.camera.micId === ''){
        window.localStreams.camera.micId = deviceId;
      }
      if(name.split('Default - ')[1] != undefined) {
        name = '[Default Device]' // rename the default mic - only appears on Chrome & Opera
      }
      jQuery('#mic-list').append('<a class="dropdown-item" id="' + optionId + '">' + name + '</a>');
    }); 
    jQuery('#mic-list a').click(function(event) {
      var index = event.target.id.split('_')[1];
      changeStreamSource (index, "audio");
    });
  });
}

function startLiveTranscoding() {
  AgoraRTC.Logger.info("start live transcoding"); 
  var rtmpUrl = jQuery('#rtmp-url').val();
  var width = parseInt(jQuery('#window-scale-width').val(), 10);
  var height = parseInt(jQuery('#window-scale-height').val(), 10);

  var configRtmp = {
    width: width,
    height: height,
    videoBitrate: parseInt(jQuery('#video-bitrate').val(), 10),
    videoFramerate: parseInt(jQuery('#framerate').val(), 10),
    lowLatency: (jQuery('#low-latancy').val() === 'true'),
    audioSampleRate: parseInt(jQuery('#audio-sample-rate').val(), 10),
    audioBitrate: parseInt(jQuery('#audio-bitrate').val(), 10),
    audioChannels: parseInt(jQuery('#audio-channels').val(), 10),
    videoGop: parseInt(jQuery('#video-gop').val(), 10),
    videoCodecProfile: parseInt(jQuery('#video-codec-profile').val(), 10),
    userCount: 1,
    userConfigExtraInfo: {},
    backgroundColor: parseInt(jQuery('#background-color-picker').val(), 16),
    transcodingUsers: [{
      uid: window.localStreams.uid,
      alpha: 1,
      width: width,
      height: height,
      x: 0,
      y: 0,
      zOrder: 0
    }],
  };

  // set live transcoding config
  window.agoraClient.setLiveTranscoding(configRtmp);
  if(rtmpUrl !== '') {
    window.agoraClient.startLiveStreaming(rtmpUrl, true)
    window.externalBroadcastUrl = rtmpUrl;
    addExternalTransmitionMiniView(rtmpUrl)
  }
}

function addExternalSource() {
  var externalUrl = jQuery('#external-url').val();
  var width = parseInt(jQuery('#external-window-scale-width').val(), 10);
  var height = parseInt(jQuery('#external-window-scale-height').val(), 10);

  var injectStreamConfig = {
    width: width,
    height: height,
    videoBitrate: parseInt(jQuery('#external-video-bitrate').val(), 10),
    videoFramerate: parseInt(jQuery('#external-framerate').val(), 10),
    audioSampleRate: parseInt(jQuery('#external-audio-sample-rate').val(), 10),
    audioBitrate: parseInt(jQuery('#external-audio-bitrate').val(), 10),
    audioChannels: parseInt(jQuery('#external-audio-channels').val(), 10),
    videoGop: parseInt(jQuery('#external-video-gop').val(), 10)
  };

  // set live transcoding config
  window.agoraClient.addInjectStreamUrl(externalUrl, injectStreamConfig)
  injectedStreamURL = externalUrl;
  // TODO: ADD view for external url (similar to rtmp url)
}

// RTMP Connection (UI Component)
function addExternalTransmitionMiniView(rtmpUrl) {
  var container = jQuery('#rtmp-controlers');
  // append the remote stream template to #remote-streams
  container.append(
    jQuery('<div/>', {'id': 'rtmp-container',  'class': 'container row justify-content-end mb-2'}).append(
      jQuery('<div/>', {'class': 'pulse-container'}).append(
          jQuery('<button/>', {'id': 'rtmp-toggle', 'class': 'btn btn-lg col-flex pulse-button pulse-anim mt-2'})
      ),
      jQuery('<input/>', {'id': 'rtmp-url', 'val': rtmpUrl, 'class': 'form-control col-flex" value="rtmps://live.facebook.com', 'type': 'text', 'disabled': true}),
      jQuery('<button/>', {'id': 'removeRtmpUrl', 'class': 'btn btn-lg col-flex close-btn'}).append(
        jQuery('<i/>', {'class': 'fas fa-xs fa-trash'})
      )
    )
  );
  
  jQuery('#rtmp-toggle').click(function() {
    if (jQuery(this).hasClass('pulse-anim')) {
      window.agoraClient.stopLiveStreaming(externalBroadcastUrl)
    } else {
      window.agoraClient.startLiveStreaming(externalBroadcastUrl, true)
    }
    jQuery(this).toggleClass('pulse-anim');
    jQuery(this).blur();
  });

  jQuery('#removeRtmpUrl').click(function() { 
    window.agoraClient.stopLiveStreaming(externalBroadcastUrl);
    externalBroadcastUrl = '';
    jQuery('#rtmp-container').remove();
  });

}
