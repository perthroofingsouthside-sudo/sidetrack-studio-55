# Sidetrack Studio 55: Feature Roadmap
## Family Karaoke + Sample Studio System

**Vision:** Transform Sidetrack into a console-friendly family karaoke and music production app combining:
- **Koala Sampler-style** sample creation/sequencing
- **Guitar Hero/SingStar-style** rhythm game mechanics
- Designed for TV/console play with gamepad support

---

## Phase 1: Audio Engine Layer ⚙️
**Goal:** Establish Web Audio API foundation and Tone.js integration
**Est. Timeline:** 1-2 weeks
**Dependencies:** None (foundational)

### 1.1 Setup Audio Infrastructure
- [ ] Install & configure Tone.js library
- [ ] Create audio context manager (singleton pattern)
- [ ] Create audio utilities module
- [ ] Setup audio file loader (WAV, MP3, OGG support)
- [ ] Create debug/monitoring tools for audio

**Files to Create:**
```
frontend/src/
  ├── services/
  │   ├── audioContext.ts          // Core Web Audio setup
  │   ├── audioLoader.ts            // Load/parse audio files
  │   └── audioUtils.ts             // Helper functions
  ├── hooks/
  │   └── useAudioContext.ts         // React hook for audio
  └── lib/
      └── audioConfig.ts            // Constants & config
```

### 1.2 Playback Engine
- [ ] Create basic audio player class
- [ ] Implement play/pause/stop controls
- [ ] Add volume control with gain nodes
- [ ] Create playback position tracking
- [ ] Setup event system (onPlay, onStop, onComplete)

**Files to Create:**
```
frontend/src/services/
  ├── player/
  │   ├── Player.ts                // Main playback engine
  │   ├── VolumeController.ts       // Volume/gain management
  │   └── playbackEvents.ts         // Event types
```

### 1.3 Effects Chain Architecture
- [ ] Design effects processor pipeline
- [ ] Create effect base class (abstract)
- [ ] Implement gain effect
- [ ] Implement filter effect (low-pass, high-pass, band-pass)
- [ ] Create effect chain manager

**Files to Create:**
```
frontend/src/services/
  └── effects/
      ├── Effect.ts                // Base effect class
      ├── GainEffect.ts
      ├── FilterEffect.ts
      └── EffectChain.ts           // Pipeline manager
```

### 1.4 Microphone Input Handler
- [ ] Setup microphone access (with permissions)
- [ ] Create microphone stream manager
- [ ] Setup audio analyser for real-time data
- [ ] Create frequency/amplitude extraction
- [ ] Build microphone level monitoring

**Files to Create:**
```
frontend/src/services/
  └── microphone/
      ├── MicrophoneManager.ts
      ├── AudioAnalyser.ts
      └── microphoneEvents.ts
```

### 1.5 Audio State Management
- [ ] Create Zustand store for audio state
- [ ] Track: playback status, volume, current position, active effects
- [ ] Create selectors & actions
- [ ] Add persistence (localStorage for settings)

**Files to Create:**
```
frontend/src/store/
  └── audioStore.ts
```

**Deliverables:**
- ✅ Functional audio playback system
- ✅ Effects can be chained
- ✅ Microphone input accessible
- ✅ React components can control audio
- ✅ Test suite for audio services

---

## Phase 2: Sample System Module 🎛️
**Goal:** Build Koala Sampler-like sample creation, management, and sequencing
**Est. Timeline:** 2-3 weeks
**Dependencies:** Phase 1 (Audio Engine)

### 2.1 Sample Data Structure & Management
- [ ] Define Sample interface (name, duration, pitch, volume, etc.)
- [ ] Create SampleBank class (CRUD operations)
- [ ] Implement sample loading from files
- [ ] Create sample metadata system
- [ ] Add sample validation

**Files to Create:**
```
frontend/src/
  ├── types/
  │   ├── Sample.ts                // Sample interface
  │   └── SampleBank.ts            // Bank interface
  ├── services/
  │   └── sample/
  │       ├── SampleBank.ts        // Manage samples
  │       ├── SampleLoader.ts      // Load sample files
  │       └── sampleUtils.ts
```

### 2.2 Sample Playback Engine
- [ ] Create sampler voice class (polyphonic)
- [ ] Implement pitch shifting
- [ ] Add playback speed control
- [ ] Create voice stealing (limit polyphony)
- [ ] Setup voice pool for performance

**Files to Create:**
```
frontend/src/services/
  └── sampler/
      ├── SamplerVoice.ts
      ├── Sampler.ts               // Main sampler engine
      ├── VoicePool.ts
      └── samplerEvents.ts
```

### 2.3 Sequencer Grid System
- [ ] Design grid sequencer UI (NxN grid, e.g., 16x8)
- [ ] Create sequencer step data structure
- [ ] Implement playback timing (tempo, BPM)
- [ ] Add pattern storage/recall
- [ ] Create UI grid component (React)

**Files to Create:**
```
frontend/src/
  ├── types/
  │   └── Sequence.ts              // Step, pattern types
  ├── services/
  │   └── sequencer/
  │       ├── Sequencer.ts         // Timing engine
  │       ├── SequencePlayer.ts    // Play patterns
  │       └── sequencerEvents.ts
  └── components/
      └── Sequencer/
          ├── SequencerGrid.tsx    // Grid UI
          ├── StepButton.tsx
          └── SequencerControls.tsx
```

### 2.4 Sample Effects & Modulation
- [ ] Apply effects chain to samples
- [ ] Add envelope (ADSR) per sample
- [ ] Create LFO (low-frequency oscillator) for modulation
- [ ] Add sample reverb/delay
- [ ] Implement panning

**Files to Create:**
```
frontend/src/services/
  └── sampler/
      ├── SampleEnvelope.ts        // ADSR
      ├── SampleModulation.ts      // LFO, etc.
      └── SampleEffects.ts
```

### 2.5 Sample Browser UI
- [ ] Create sample library component
- [ ] Add sample upload interface
- [ ] Implement sample preview
- [ ] Create sample organizer (folders/categories)
- [ ] Add search/filter

**Files to Create:**
```
frontend/src/components/
  └── SampleBrowser/
      ├── SampleBrowser.tsx        // Main component
      ├── SampleGrid.tsx
      ├── SampleUpload.tsx
      ├── SamplePreview.tsx
      └── SampleFilter.tsx
```

### 2.6 Sequencer UI & Controls
- [ ] Build full sequencer interface
- [ ] Add tempo/BPM control
- [ ] Create pattern save/load UI
- [ ] Add track mixer
- [ ] Implement master volume/mute

**Files to Create:**
```
frontend/src/components/
  └── Sequencer/
      ├── SequencerContainer.tsx
      ├── TrackMixer.tsx
      ├── TempoControl.tsx
      └── PatternManager.tsx
```

### 2.7 State Management for Samples
- [ ] Create Zustand store for samples
- [ ] Track: loaded samples, current pattern, tempo, playback
- [ ] Create undo/redo system
- [ ] Add export/import patterns

**Files to Create:**
```
frontend/src/store/
  └── sampleStore.ts
```

**Deliverables:**
- ✅ Can load audio samples
- ✅ Can play samples with pitch/speed control
- ✅ Grid sequencer functional
- ✅ Save/load patterns
- ✅ Real-time pattern playback
- ✅ Full UI for sample management

---

## Phase 3: Karaoke/Rhythm Game Module 🎮
**Goal:** Build Guitar Hero/SingStar-style gameplay with pitch detection
**Est. Timeline:** 3-4 weeks
**Dependencies:** Phase 1 (Audio Engine), Phase 2 optional

### 3.1 Song/Track Management
- [ ] Define Song interface (metadata, backing track, lyrics, notes)
- [ ] Create SongLibrary class
- [ ] Implement song file format (JSON for note data)
- [ ] Add song metadata (difficulty, duration, artist, etc.)
- [ ] Create song search/filter

**Files to Create:**
```
frontend/src/
  ├── types/
  │   ├── Song.ts                  // Song interface
  │   ├── Note.ts                  // Note event interface
  │   └── LyricsLine.ts            // Lyrics sync
  ├── services/
  │   └── songs/
  │       ├── SongLibrary.ts
  │       ├── SongLoader.ts
  │       └── songUtils.ts
```

### 3.2 Pitch Detection Engine
- [ ] Install ML-based pitch detection (ml5.js or CREPE)
- [ ] Create pitch detector service
- [ ] Implement real-time pitch extraction
- [ ] Add smoothing/filtering (reduce jitter)
- [ ] Create pitch confidence scoring

**Files to Create:**
```
frontend/src/services/
  └── pitchDetection/
      ├── PitchDetector.ts         // Main detector
      ├── PitchAnalyser.ts         // Analysis logic
      ├── pitchSmoothing.ts        // Jitter reduction
      └── pitchEvents.ts
```

### 3.3 Note Matching & Scoring
- [ ] Create note matching algorithm
- [ ] Define scoring system (perfect, great, good, miss)
- [ ] Implement combo multiplier
- [ ] Add feedback (visual + audio)
- [ ] Create score aggregation

**Files to Create:**
```
frontend/src/services/
  └── scoring/
      ├── NoteMatcher.ts           // Match detected pitch to notes
      ├── ScoringEngine.ts         // Calculate score
      ├── FeedbackGenerator.ts     // Score feedback
      └── scoringUtils.ts
```

### 3.4 Game UI: Falling Notes Display
- [ ] Create canvas-based note renderer
- [ ] Implement note falling animation
- [ ] Add hit zone visualization
- [ ] Create score/combo display
- [ ] Add real-time pitch indicator

**Files to Create:**
```
frontend/src/components/
  └── Game/
      ├── GameRenderer.tsx         // Canvas rendering
      ├── NoteRenderer.ts          // Note drawing logic
      ├── HitZone.tsx              // Visual feedback zone
      ├── ScoreDisplay.tsx
      ├── ComboCounter.tsx
      └── PitchIndicator.tsx
```

### 3.5 Game State Management
- [ ] Create game state Zustand store
- [ ] Track: current song, score, combo, detected pitch, notes hit
- [ ] Add pause/resume logic
- [ ] Implement game over detection
- [ ] Add result screen state

**Files to Create:**
```
frontend/src/store/
  └── gameStore.ts
```

### 3.6 Song Selection & Settings
- [ ] Create song browser component
- [ ] Add difficulty selector
- [ ] Implement game settings (pitch range, visual effects)
- [ ] Create preview functionality
- [ ] Add favorite/recently played

**Files to Create:**
```
frontend/src/components/
  └── Game/
      ├── SongSelector.tsx
      ├── SongCard.tsx
      ├── DifficultyPicker.tsx
      ├── GameSettings.tsx
      └── SongPreview.tsx
```

### 3.7 Results & Stats Screen
- [ ] Create results display component
- [ ] Show final score, accuracy, combo
- [ ] Add difficulty rating
- [ ] Implement stats history
- [ ] Add comparison (vs friends/family)

**Files to Create:**
```
frontend/src/components/
  └── Game/
      ├── ResultsScreen.tsx
      ├── ScoreBreakdown.tsx
      ├── StatsHistory.tsx
      └── Leaderboard.tsx
```

**Deliverables:**
- ✅ Can select & play songs
- ✅ Real-time pitch detection working
- ✅ Notes fall in sync with music
- ✅ Pitch matching scores notes
- ✅ Results screen shows performance
- ✅ Full game loop functional

---

## Phase 4: Gamepad/Controller Support 🎮🕹️
**Goal:** Full console-friendly gamepad/controller integration
**Est. Timeline:** 1-2 weeks
**Dependencies:** Phase 1 (Audio Engine)

### 4.1 Gamepad API Integration
- [ ] Setup gamepad polling system
- [ ] Create button mapping abstraction
- [ ] Implement stick/trigger handling
- [ ] Add vibration feedback support
- [ ] Create gamepad detection/connection

**Files to Create:**
```
frontend/src/services/
  └── gamepad/
      ├── GamepadManager.ts        // Polling & detection
      ├── GamepadMapper.ts         // Button mapping
      ├── GamepadVibration.ts      // Haptic feedback
      └── gamepadEvents.ts
```

### 4.2 Input Handler for UI Navigation
- [ ] Create navigation service (D-Pad/analog stick)
- [ ] Implement menu focusing system
- [ ] Add scroll handling
- [ ] Create action button (A/X/etc.)
- [ ] Add back button (B/Circle)

**Files to Create:**
```
frontend/src/hooks/
  └── useGamepadNavigation.ts

frontend/src/components/
  └── GamepadUI/
      ├── GamepadNavigable.tsx     // Wrapper for gamepad nav
      └── GamepadButton.tsx
```

### 4.3 Game Controls Mapping
- [ ] Map controls for sample sequencer
  - D-Pad: grid navigation
  - Buttons: toggle steps
  - Triggers: select instruments
  - Sticks: adjust parameters
- [ ] Map controls for karaoke game
  - Buttons: start/pause/ready
  - Triggers: none (uses mic)

**Files to Create:**
```
frontend/src/config/
  └── gamepadConfig.ts
```

### 4.4 Mobile/TV-Friendly UI Adjustments
- [ ] Increase button sizes for couch use
- [ ] Improve contrast for TV viewing
- [ ] Add focus rings (gamepad navigation)
- [ ] Optimize layouts for 16:9 displays
- [ ] Add safe area spacing

**Files to Modify:**
```
frontend/tailwind.config.js         // Add safe-area utilities
frontend/src/styles/gamepad.css     // Gamepad-specific styles
```

### 4.5 Multi-Player Setup
- [ ] Detect multiple gamepads
- [ ] Create player assignment screen
- [ ] Implement turn-based input routing
- [ ] Add game modes (versus, cooperative)
- [ ] Create split-screen support for UI

**Files to Create:**
```
frontend/src/services/
  └── multiplayer/
      ├── MultiplayerManager.ts
      └── PlayerManager.ts
```

**Deliverables:**
- ✅ Gamepad detection working
- ✅ Full UI navigation via gamepad
- ✅ Sample sequencer playable with gamepad
- ✅ Karaoke game playable with gamepad
- ✅ Multiple gamepads supported
- ✅ Vibration feedback working

---

## Phase 5: Integration & Polish 🎨
**Goal:** Connect all modules, optimize, and prepare for deployment
**Est. Timeline:** 2-3 weeks
**Dependencies:** Phases 1-4

### 5.1 Main App Navigation
- [ ] Create main menu/dashboard
- [ ] Add mode selector (Sampler, Karaoke, etc.)
- [ ] Implement navigation flow
- [ ] Add settings/preferences panel
- [ ] Create help/tutorial system

**Files to Create:**
```
frontend/src/components/
  ├── MainMenu/
  │   ├── MainMenu.tsx
  │   ├── ModeSelector.tsx
  │   ├── SettingsPanel.tsx
  │   └── HelpModal.tsx
  └── Navigation/
      └── AppRouter.tsx
```

### 5.2 Session Management
- [ ] Create session save/load system
- [ ] Implement auto-save
- [ ] Add backup functionality
- [ ] Create session history
- [ ] Add cloud sync option (optional)

**Files to Create:**
```
frontend/src/services/
  └── sessions/
      ├── SessionManager.ts
      ├── SessionStorage.ts
      └── sessionUtils.ts
```

### 5.3 Audio File Management
- [ ] Create database for samples/songs
- [ ] Implement file organization
- [ ] Add file transfer/sync
- [ ] Create backup/restore
- [ ] Add cleanup utilities

**Files to Create:**
```
frontend/src/services/
  └── storage/
      ├── FileManager.ts
      ├── StorageManager.ts
      └── storageUtils.ts
```

### 5.4 Performance Optimization
- [ ] Code splitting for features
- [ ] Lazy load game components
- [ ] Optimize audio processing
- [ ] Add audio worklet for pitch detection
- [ ] Memory profiling & cleanup

### 5.5 Accessibility Improvements
- [ ] Ensure keyboard navigation works
- [ ] Add screen reader support
- [ ] Test colorblind modes
- [ ] Add closed captions for songs
- [ ] Test on actual TV displays

### 5.6 Testing & Bug Fixes
- [ ] Unit tests for all services
- [ ] Integration tests for modules
- [ ] E2E tests for game modes
- [ ] Gamepad testing across devices
- [ ] Audio testing on different systems

**Files to Create:**
```
frontend/src/__tests__/
  ├── services/          // Service tests
  ├── components/        // Component tests
  ├── integration/       // Integration tests
  └── e2e/              // End-to-end tests
```

### 5.7 Documentation
- [ ] API documentation for services
- [ ] Component documentation
- [ ] User guide / manual
- [ ] Developer guide
- [ ] Troubleshooting guide

**Files to Create:**
```
docs/
  ├── API.md
  ├── COMPONENTS.md
  ├── USER_GUIDE.md
  ├── DEVELOPMENT.md
  └── TROUBLESHOOTING.md
```

**Deliverables:**
- ✅ Fully integrated application
- ✅ All features working together
- ✅ Optimized performance
- ✅ Comprehensive testing
- ✅ Full documentation
- ✅ Ready for distribution

---

## Timeline Summary

| Phase | Name | Est. Duration | Start | End |
|-------|------|---------------|-------|-----|
| 1 | Audio Engine | 1-2 weeks | Week 1 | Week 2 |
| 2 | Sample System | 2-3 weeks | Week 3 | Week 5 |
| 3 | Karaoke Game | 3-4 weeks | Week 6 | Week 9 |
| 4 | Gamepad Support | 1-2 weeks | Week 10 | Week 11 |
| 5 | Integration & Polish | 2-3 weeks | Week 12 | Week 14 |
| **TOTAL** | | **9-14 weeks** | | |

---

## Technology Stack

### Core Audio
- **Tone.js** - Audio synthesis & scheduling
- **Web Audio API** - Low-level audio control
- **CREPE or ml5.js** - Pitch detection

### Game Graphics
- **Canvas 2D API** - Note rendering (efficient)
- **HTML5 Audio** - Backing track playback

### Input
- **Gamepad API** - Controller support
- **Web Audio getUserMedia** - Microphone access

### State Management
- **Zustand** - Lightweight state (already in use)

### UI Framework
- **React 19** - Already in use
- **Radix UI** - Already in use
- **Tailwind CSS** - Already in use

### Testing
- **Jest** - Unit testing
- **React Testing Library** - Component testing
- **Cypress** - E2E testing

### Storage
- **IndexedDB** - Large audio files
- **localStorage** - Settings/preferences

---

## Key Design Decisions

1. **Audio Processing:** Use Web Audio API directly where possible, Tone.js for higher-level abstractions
2. **Pitch Detection:** ML-based (CREPE) for accuracy over real-time speed initially
3. **Game Rendering:** Canvas 2D (fast, performant) over WebGL/Three.js
4. **State:** Zustand for simplicity and React integration
5. **Styling:** Leverage existing Tailwind config + gamepad-specific utilities
6. **Multi-player:** Local only initially (via multiple gamepads)

---

## Success Metrics

✅ Audio playback with effects working
✅ Sample sequencer functional & intuitive
✅ Karaoke game with real-time pitch detection
✅ Full gamepad support (all modes playable)
✅ 60 FPS on game rendering
✅ Sub-50ms pitch detection latency
✅ Support for 4+ simultaneous gamepads
✅ Song library with 10+ tracks
✅ Complete test coverage (>80%)
✅ Full documentation & user guide
