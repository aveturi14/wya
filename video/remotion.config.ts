import { Config } from '@remotion/cli/config';

// H.264 + AAC at 1080×1920, 30 fps: the Instagram Reels master
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
