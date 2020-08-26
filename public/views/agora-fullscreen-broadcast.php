<?php
$current_path = plugins_url('wp-agora-io') . '/public';
$channelSettings    = $channel->get_properties();
$videoSettings      = $channelSettings['settings'];
$appearanceSettings = $channelSettings['appearance'];
$recordingSettings  = $channelSettings['recording'];
$current_user       = wp_get_current_user();
?>
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Agora.io Communication Chat</title>
  <?php wp_head() ?>
</head>
<body <?php body_class(); ?>>
  <div id="agora-root" class="agora agora-fullscreen">
    <section class="agora-container">
      <?php require_once "parts/header.php" ?>

      <div class="agora-content">
        <?php require_once "parts/header-controls.php" ?>

        <div id="screen-zone" class="screen">
          <div id="screen-users" class="screen-users screen-users-1">
            <div id="full-screen-video" class="user"></div>
          </div>
        </div>
      </div>
      <?php require_once "parts/footer-broadcast.php" ?>
    </section>
    

    <!-- RTMP Config Modal -->
    <div class="modal fade slideInLeft animated" id="addRtmpConfigModal" tabindex="-1" role="dialog" aria-labelledby="rtmpConfigLabel" aria-hidden="true" data-keyboard=true>
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="rtmpConfigLabel"><i class="fas fa-sliders-h"></i></h5>
            <button type="button" class="close" data-dismiss="modal" data-reset="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <form id="rtmp-config" action="" method="post" onSubmit="return false;">
              <div class="form-group">
                <label for="input_rtmp_url">RTMP Server URL</label>
                <input type="url" class="form-control" id="input_rtmp_url" placeholder="Enter the RTMP Server URL" value="" required />
              </div>
              <div class="form-group">
                <label for="input_private_key">Stream key</label>
                <input type="text" class="form-control" id="input_private_key" placeholder="Enter stream key" required />
              </div>
              <input type="submit" value="Start RTMP" style="position:fixed; top:-999999px">
            </form>
          </div>
          <div class="modal-footer">
            <span id="rtmp-error-msg" class="error text-danger" style="display: none">Please complete the information!</span>
            <button type="button" id="start-RTMP-broadcast" class="btn btn-primary">
              <i class="fas fa-satellite-dish"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- end Modal -->

    <!-- External Injest Url Modal -->
    <div class="modal fade slideInLeft animated" id="add-external-source-modal" tabindex="-1" role="dialog" aria-labelledby="add-external-source-url-label" aria-hidden="true" data-keyboard=true>
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="add-external-source-url-label">
              <i class="fas fa-broadcast-tower"></i> [add external url]
            </h5>
            <button id="hide-external-url-modal" type="button" class="close" data-dismiss="modal" data-reset="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <form id="external-inject-config">
              <div class="form-group">
                <label for="input_external_url">External URL</label>
                <input type="url" class="form-control" id="input_external_url" placeholder="Enter the external URL" required>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <span id="external-url-error" class="error text-danger" style="display: none">Please enter a valid external URL</span>
            <button type="button" id="add-external-stream" class="btn btn-primary">
                <i id="add-rtmp-icon" class="fas fa-plug"></i>  
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- end Modal -->
    
  </div>

  <?php wp_footer(); ?>
  <?php require_once "parts/scripts-common.php" ?>
  <script>
    
    window.agoraCurrentRole = 'host';
    window.agoraMode = 'broadcast';

    window.externalBroadcastUrl = '';

    // default config for rtmp
    window.defaultConfigRTMP = {
      width: <?php echo $videoSettings['external-width'] ?>,
      height: <?php echo $videoSettings['external-height'] ?>,
      videoBitrate: <?php echo $videoSettings['external-videoBitrate'] ?>,
      videoFramerate: <?php echo $videoSettings['external-videoFramerate'] ?>,
      lowLatency: <?php echo $videoSettings['external-lowLatency'] ?>,
      audioSampleRate: <?php echo $videoSettings['external-audioSampleRate'] ?>,
      audioBitrate: <?php echo $videoSettings['external-audioBitrate'] ?>,
      audioChannels: <?php echo $videoSettings['external-audioChannels'] ?>,
      videoGop: <?php echo $videoSettings['external-videoGop'] ?>,
      videoCodecProfile: <?php echo $videoSettings['external-videoCodecProfile'] ?>,
      userCount: 1,
      userConfigExtraInfo: {},
      backgroundColor: parseInt('<?php echo str_replace('#', '', $videoSettings['external-backgroundColor']) ?>', 16),
      transcodingUsers: [{
        uid: window.userID,
        alpha: 1,
        width: <?php echo $videoSettings['external-width'] ?>,
        height: <?php echo $videoSettings['external-height'] ?>,
        x: 0,
        y: 0,
        zOrder: 0
      }],
    };

    window.injectStreamConfig = {
      width: <?php echo $videoSettings['inject-width'] ?>,
      height: <?php echo $videoSettings['inject-height'] ?>,
      videoBitrate: <?php echo $videoSettings['inject-videoBitrate'] ?>,
      videoFramerate: <?php echo $videoSettings['inject-videoFramerate'] ?>,
      audioSampleRate: <?php echo $videoSettings['inject-audioSampleRate'] ?>,
      audioBitrate: <?php echo $videoSettings['inject-audioBitrate'] ?>,
      audioChannels: <?php echo $videoSettings['inject-audioChannels'] ?>,
      videoGop: <?php echo $videoSettings['inject-videoGop'] ?>,
    };

    window.addEventListener('load', function() {

      // create client instance
      window.agoraClient = AgoraRTC.createClient({mode: 'live', codec: 'vp8'}); // h264 better detail at a higher motion
      
      window.mainStreamId; // reference to main stream

      // set video profile 
      // [full list: https://docs.agora.io/en/Interactive%20Broadcast/videoProfile_web?platform=Web#video-profile-table]
      
      // set log level:
      // -- .DEBUG for dev 
      // -- .NONE for prod
      // window.agoraLogLevel = window.location.href.indexOf('localhost')>0 ? AgoraRTC.Logger.DEBUG : AgoraRTC.Logger.ERROR;
      window.agoraLogLevel = window.location.href.indexOf('localhost')>0 ? AgoraRTC.Logger.ERROR : AgoraRTC.Logger.ERROR;
      AgoraRTC.Logger.setLogLevel(window.agoraLogLevel);
      // TODO: set DEBUG or NOE according to the current host (localhost or not)

      

      // init Agora SDK
      window.agoraClient.init(window.agoraAppId, function () {
        AgoraRTC.Logger.info('AgoraRTC client initialized');
        agoraJoinChannel(); // join channel upon successfull init
      }, function (err) {
        AgoraRTC.Logger.error('[ERROR] : AgoraRTC client init failed', err);
      });

      window.agoraClient.on('liveStreamingStarted', function (evt) {
        console.log("Live streaming started", evt);
      }); 

      window.agoraClient.on('liveStreamingFailed', function (evt) {
        console.log("Live streaming failed", evt);
      }); 

      window.agoraClient.on('liveStreamingStopped', function (evt) {
        console.log("Live streaming stopped", evt);
      });

      window.agoraClient.on('liveTranscodingUpdated', function (evt) {
        console.log("Live streaming updated", evt);
      });

      window.agoraClient.on('streamInjectedStatus', function (evt) {
        console.log("Live streaming Injected Status:", evt);
      });

      window.agoraClient.on('stream-added', function (evt) {
        console.log("streaming Injected:", evt);
      });
      window.agoraClient.on('exception', function (ex) {
        console.error("Agora Exception:", ex);
      });

    });// end addEventListener Load

  </script>
</body>
</html>