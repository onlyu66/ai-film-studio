import assert from 'node:assert/strict'
import { test, describe, it, beforeEach } from 'node:test'
import { WebAudioMixer } from './WebAudioMixer.ts'

describe('WebAudioMixer Unit Tests', () => {
  let mixer: WebAudioMixer

  beforeEach(() => {
    mixer = new WebAudioMixer()
  })

  it('initializes with default volume and unmuted tracks', () => {
    assert.equal(mixer.getTrackState('voice').isMuted, false)
    assert.equal(mixer.getTrackState('voice').volume, 1.0)
    assert.equal(mixer.getTrackState('bgm').volume, 0.7)
    assert.equal(mixer.getTrackState('sfx').volume, 0.85)
  })

  it('updates mute state on track correctly', () => {
    mixer.setTrackMute('sfx', true)
    assert.equal(mixer.getTrackState('sfx').isMuted, true)
    mixer.setTrackMute('sfx', false)
    assert.equal(mixer.getTrackState('sfx').isMuted, false)
  })

  it('updates volume on track correctly with clamping', () => {
    mixer.setTrackVolume('voice', 0.5)
    assert.equal(mixer.getTrackState('voice').volume, 0.5)
    mixer.setTrackVolume('voice', 2.5) // clamped to 1.5
    assert.equal(mixer.getTrackState('voice').volume, 1.5)
  })

  it('calculates active shot at timecode accurately', () => {
    const shots = [
      { id: 's1', duration: 3.0 },
      { id: 's2', duration: 4.0 },
      { id: 's3', duration: 2.5 },
    ]
    const shot1 = mixer.findShotAtTime(1.5, shots)
    assert.equal(shot1?.shot.id, 's1')
    assert.equal(shot1?.startSec, 0)
    assert.equal(shot1?.endSec, 3.0)
    assert.equal(shot1?.offsetSec, 1.5)

    const shot2 = mixer.findShotAtTime(4.0, shots)
    assert.equal(shot2?.shot.id, 's2')
    assert.equal(shot2?.startSec, 3.0)
    assert.equal(shot2?.endSec, 7.0)
    assert.equal(shot2?.offsetSec, 1.0)

    const notFound = mixer.findShotAtTime(10.0, shots)
    assert.equal(notFound, null)
  })

  it('calculates timeline durations correctly', () => {
    const shots = [
      { id: 's1', duration: 2.0 },
      { id: 's2', duration: 3.5 },
    ]
    const timeline = mixer.calculateTimeline(shots)
    assert.equal(timeline.length, 2)
    assert.equal(timeline[0].startSec, 0)
    assert.equal(timeline[0].endSec, 2.0)
    assert.equal(timeline[1].startSec, 2.0)
    assert.equal(timeline[1].endSec, 5.5)
  })
})
