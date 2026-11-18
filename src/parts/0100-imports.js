import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-simd-compat';   // SIMD build: ~1.8x faster physics on big collapses
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makePhysics, V3, Q4, GRAV } from './phys.js';
import { createElement as lucideEl, Menu, Pause, Play, Home, Settings, CircleHelp, X, Coins, Undo2, Redo2, Trash2, Volume2, VolumeX, Moon, Film, Camera, Video, Move, Focus, Hammer, Bomb, Plus, MousePointerClick, Ruler, Square, SquareDashed, Link, Eraser, Paintbrush, Pipette, FlipHorizontal2, ArrowUpDown, Scale, Construction, Blocks, Ellipsis, RotateCcw, Snail, Tornado, Trophy, CalendarDays, Swords, Store, MessageSquare, Bug, Shield, Info, Share2, Copy, Download, Upload, ChevronRight, ChevronLeft, Sparkles, Lock, Star, Check, Gauge, Hand, Github, Zap, Eye, EyeOff, Layers, User, Castle, Crosshair, Wand2, BookOpen, Vibrate, RefreshCw, LogOut } from 'lucide';
const LUCIDE = { Menu, Pause, Play, Home, Settings, CircleHelp, X, Coins, Undo2, Redo2, Trash2, Volume2, VolumeX, Moon, Film, Camera, Video, Move, Focus, Hammer, Bomb, Plus, MousePointerClick, Ruler, Square, SquareDashed, Link, Eraser, Paintbrush, Pipette, FlipHorizontal2, ArrowUpDown, Scale, Construction, Blocks, Ellipsis, RotateCcw, Snail, Tornado, Trophy, CalendarDays, Swords, Store, MessageSquare, Bug, Shield, Info, Share2, Copy, Download, Upload, ChevronRight, ChevronLeft, Sparkles, Lock, Star, Check, Gauge, Hand, Github, Zap, Eye, EyeOff, Layers, User, Castle, Crosshair, Wand2, BookOpen, Vibrate, RefreshCw, LogOut };
bootStep(.55, 'Starting the physics engine…');
// the physics engine needs WebAssembly SIMD (iOS 16.4+, Chrome 91+, Firefox 89+)
const HAS_SIMD = (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } })();
if (!HAS_SIMD) { bootFail('old'); throw new Error('WebAssembly SIMD not supported'); }
try { await RAPIER.init(); } catch (e) { bootFail(); throw e; }
bootStep(.8, 'Raising the castle…');

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

