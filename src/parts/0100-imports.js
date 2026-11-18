import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makePhysics, V3, Q4, GRAV } from './phys.js';
import { createElement as lucideEl, Menu, Pause, Play, Home, Settings, CircleHelp, X, Coins, Undo2, Redo2, Trash2, Volume2, VolumeX, Moon, Film, Camera, Video, Move, Focus, Hammer, Bomb, Plus, MousePointerClick, Ruler, Square, SquareDashed, Link, Eraser, Paintbrush, Pipette, FlipHorizontal2, ArrowUpDown, Scale, Construction, Blocks, Ellipsis, RotateCcw, Snail, Tornado, Trophy, CalendarDays, Swords, Store, MessageSquare, Bug, Shield, Info, Share2, Copy, Download, Upload, ChevronRight, ChevronLeft, Sparkles, Lock, Star, Check, Gauge, Hand, Github, Zap, Eye, EyeOff, Layers, User, Castle, Crosshair, Wand2, BookOpen, Vibrate, RefreshCw, LogOut } from 'lucide';
const LUCIDE = { Menu, Pause, Play, Home, Settings, CircleHelp, X, Coins, Undo2, Redo2, Trash2, Volume2, VolumeX, Moon, Film, Camera, Video, Move, Focus, Hammer, Bomb, Plus, MousePointerClick, Ruler, Square, SquareDashed, Link, Eraser, Paintbrush, Pipette, FlipHorizontal2, ArrowUpDown, Scale, Construction, Blocks, Ellipsis, RotateCcw, Snail, Tornado, Trophy, CalendarDays, Swords, Store, MessageSquare, Bug, Shield, Info, Share2, Copy, Download, Upload, ChevronRight, ChevronLeft, Sparkles, Lock, Star, Check, Gauge, Hand, Github, Zap, Eye, EyeOff, Layers, User, Castle, Crosshair, Wand2, BookOpen, Vibrate, RefreshCw, LogOut };
bootStep(.55, 'Starting the physics engine…');
try { await RAPIER.init(); } catch (e) { bootFail(); throw e; }
bootStep(.8, 'Raising the castle…');

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

