/*
 * Timestamp Cutter CEP - ExtendScript host code for Adobe Premiere Pro.
 */

var TIMESTAMP_CUTTER_TICKS_PER_SECOND = 254016000000;

function jsonResult(payload) {
    try {
        return JSON.stringify(payload);
    } catch (e) {
        return "{\"success\":false,\"error\":\"Could not serialize response.\"}";
    }
}

function pad2(value) {
    value = Math.floor(Math.abs(value));
    return value < 10 ? "0" + value : String(value);
}

function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}

function getSequenceFPS(sequence) {
    var fps = 25;

    try {
        if (sequence && sequence.timebase) {
            fps = TIMESTAMP_CUTTER_TICKS_PER_SECOND / Number(sequence.timebase);
        }
    } catch (e) {}

    if (!fps || fps <= 0 || isNaN(fps)) {
        fps = 25;
    }

    return fps;
}

function getFrameRateForTimecode(fps) {
    var rounded = Math.round(fps);
    return rounded > 0 ? rounded : 25;
}

function parseTimestamp(raw, fps) {
    if (raw === null || raw === undefined) {
        return null;
    }

    var value = String(raw).replace(/^\s+|\s+$/g, "").toLowerCase();
    var match;
    var parts;
    var frameRate = getFrameRateForTimecode(fps || 25);

    if (!value) {
        return null;
    }

    match = value.match(/^(\d+(?:\.\d+)?)$/);
    if (match) {
        return parseFloat(match[1]);
    }

    match = value.match(/^(\d+)m(?:(\d+(?:\.\d+)?)s?)?$/);
    if (match) {
        return (parseInt(match[1], 10) * 60) + (match[2] ? parseFloat(match[2]) : 0);
    }

    match = value.match(/^(\d+(?:\.\d+)?)s$/);
    if (match) {
        return parseFloat(match[1]);
    }

    parts = value.split(":");

    if (parts.length === 2) {
        if (!isIntegerText(parts[0]) || !isNumberText(parts[1])) {
            return null;
        }
        return (parseInt(parts[0], 10) * 60) + parseFloat(parts[1]);
    }

    if (parts.length === 3) {
        if (!isIntegerText(parts[0]) || !isIntegerText(parts[1]) || !isNumberText(parts[2])) {
            return null;
        }
        return (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseFloat(parts[2]);
    }

    if (parts.length === 4) {
        if (!isIntegerText(parts[0]) || !isIntegerText(parts[1]) || !isIntegerText(parts[2]) || !isIntegerText(parts[3])) {
            return null;
        }

        var frames = parseInt(parts[3], 10);
        if (frames >= frameRate) {
            return null;
        }

        return (parseInt(parts[0], 10) * 3600) +
            (parseInt(parts[1], 10) * 60) +
            parseInt(parts[2], 10) +
            (frames / frameRate);
    }

    return null;
}

function isIntegerText(value) {
    return /^\d+$/.test(String(value));
}

function isNumberText(value) {
    return /^\d+(?:\.\d+)?$/.test(String(value));
}

function secToQETimecode(seconds, fps) {
    var frameRate = getFrameRateForTimecode(fps || 25);
    var totalFrames = Math.round(Number(seconds) * frameRate);

    if (totalFrames < 0 || isNaN(totalFrames)) {
        totalFrames = 0;
    }

    var frames = totalFrames % frameRate;
    var totalSeconds = Math.floor(totalFrames / frameRate);
    var secs = totalSeconds % 60;
    var totalMinutes = Math.floor(totalSeconds / 60);
    var mins = totalMinutes % 60;
    var hours = Math.floor(totalMinutes / 60);

    return pad2(hours) + ":" + pad2(mins) + ":" + pad2(secs) + ":" + pad2(frames);
}

function secToQEDropTimecode(seconds, fps) {
    return secToQETimecode(seconds, fps).replace(/:/g, ";");
}

function formatSeconds(seconds, fps) {
    return secToQETimecode(seconds, fps);
}

function getSequenceList() {
    try {
        if (!app.project) {
            return jsonResult({ error: "No project open." });
        }

        var sequences = [];
        var seen = {};

        try {
            for (var i = 0; i < app.project.sequences.numSequences; i++) {
                var sequence = app.project.sequences[i];
                if (sequence && sequence.sequenceID && !seen[sequence.sequenceID]) {
                    seen[sequence.sequenceID] = true;
                    sequences.push({
                        id: sequence.sequenceID,
                        name: sequence.name || ("Sequence " + (i + 1))
                    });
                }
            }
        } catch (e1) {}

        try {
            var active = app.project.activeSequence;
            if (active && active.sequenceID && !seen[active.sequenceID]) {
                sequences.push({
                    id: active.sequenceID,
                    name: active.name || "Active Sequence"
                });
            }
        } catch (e2) {}

        return jsonResult(sequences);
    } catch (e) {
        return jsonResult({ error: "getSequenceList failed: " + e.message });
    }
}

function findSequenceByID(sequenceID) {
    try {
        for (var i = 0; i < app.project.sequences.numSequences; i++) {
            var sequence = app.project.sequences[i];
            if (sequence && sequence.sequenceID === sequenceID) {
                return sequence;
            }
        }
    } catch (e) {}

    return null;
}

function activateSequence(sequenceID, logs) {
    try {
        app.project.openSequence(sequenceID);
        logs.push("Selected sequence was opened.");
    } catch (eOpen) {
        logs.push("openSequence failed: " + eOpen.message);
    }

    try {
        var active = app.project.activeSequence;
        if (active && active.sequenceID === sequenceID) {
            return active;
        }
    } catch (eActive) {
        logs.push("Could not read active sequence: " + eActive.message);
    }

    return null;
}

function collectCutPoints(ranges, fps, logs) {
    var cutPoints = [];

    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i] || {};
        var start = parseTimestamp(range.start, fps);
        var end = parseTimestamp(range.end, fps);

        if (start === null) {
            logs.push("Range " + (i + 1) + " skipped: invalid Start Time \"" + range.start + "\".");
            continue;
        }

        if (end === null) {
            logs.push("Range " + (i + 1) + " skipped: invalid End Time \"" + range.end + "\".");
            continue;
        }

        if (start >= end) {
            logs.push("Range " + (i + 1) + " skipped: Start Time must be before End Time.");
            continue;
        }

        cutPoints.push(start);
        cutPoints.push(end);
        logs.push("Range " + (i + 1) + ": " + formatSeconds(start, fps) + " - " + formatSeconds(end, fps) + ".");
    }

    cutPoints.sort(function (a, b) {
        return a - b;
    });

    return uniqueCutPoints(cutPoints);
}

function normalizeRanges(ranges, fps, logs) {
    var normalized = [];

    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i] || {};
        var start = parseTimestamp(range.start, fps);
        var end = parseTimestamp(range.end, fps);

        if (start === null || end === null || start >= end) {
            continue;
        }

        normalized.push({
            start: start,
            end: end
        });
    }

    normalized.sort(function (a, b) {
        return a.start - b.start;
    });

    var merged = [];
    var tolerance = 0.0005;

    for (var r = 0; r < normalized.length; r++) {
        if (!merged.length || normalized[r].start > merged[merged.length - 1].end + tolerance) {
            merged.push({
                start: normalized[r].start,
                end: normalized[r].end
            });
        } else if (normalized[r].end > merged[merged.length - 1].end) {
            merged[merged.length - 1].end = normalized[r].end;
        }
    }

    logs.push("Validated ranges: " + merged.length + ".");
    return merged;
}

function getSequenceEndSeconds(sequence) {
    var end = 0;

    try {
        if (sequence.end && typeof sequence.end.seconds !== "undefined") {
            end = Math.max(end, Number(sequence.end.seconds));
        }
    } catch (eEnd) {}

    end = Math.max(end, getMaxTrackEndSeconds(sequence.videoTracks));
    end = Math.max(end, getMaxTrackEndSeconds(sequence.audioTracks));

    return end;
}

function getMaxTrackEndSeconds(tracks) {
    var maxEnd = 0;

    try {
        for (var t = 0; t < tracks.numTracks; t++) {
            var track = tracks[t];
            for (var c = 0; c < track.clips.numItems; c++) {
                try {
                    var clipEnd = Number(track.clips[c].end.seconds);
                    if (clipEnd > maxEnd) {
                        maxEnd = clipEnd;
                    }
                } catch (eClip) {}
            }
        }
    } catch (eTracks) {}

    return maxEnd;
}

function getOutsideSegments(keepRanges, sequenceEnd, logs, fps) {
    var segments = [];
    var cursor = 0;
    var tolerance = 0.0005;

    for (var i = 0; i < keepRanges.length; i++) {
        if (keepRanges[i].start > cursor + tolerance) {
            segments.push({
                start: cursor,
                end: keepRanges[i].start
            });
        }

        if (keepRanges[i].end > cursor) {
            cursor = keepRanges[i].end;
        }
    }

    if (sequenceEnd > cursor + tolerance) {
        segments.push({
            start: cursor,
            end: sequenceEnd
        });
    }

    logs.push("Outside segments detected: " + segments.length + ".");
    for (var s = 0; s < segments.length; s++) {
        logs.push("Outside segment " + (s + 1) + ": " + formatSeconds(segments[s].start, fps) + " - " + formatSeconds(segments[s].end, fps) + ".");
    }

    return segments;
}

function removeOutsideSegments(sequence, qeSequence, segments, fps, logs) {
    var deleted = 0;
    var rippleApplied = 0;

    for (var i = segments.length - 1; i >= 0; i--) {
        var segment = segments[i];
        var removed = removeClipsInSegment(sequence.videoTracks, segment, false);
        removed += removeClipsInSegment(sequence.audioTracks, segment, false);
        deleted += removed;

        logs.push("Segment deleted: " + formatSeconds(segment.start, fps) + " - " + formatSeconds(segment.end, fps) + " (" + removed + " clip item(s)).");

        if (removed > 0 && tryCloseGap(sequence, qeSequence, segment.start, fps, logs)) {
            rippleApplied++;
        }
    }

    logs.push("Final summary: deleted " + deleted + " outside clip item(s).");
    return {
        deleted: deleted,
        rippleApplied: rippleApplied
    };
}

function removeClipsInSegment(tracks, segment, ripple) {
    var removed = 0;
    var tolerance = 0.0005;

    try {
        for (var t = tracks.numTracks - 1; t >= 0; t--) {
            var track = tracks[t];
            for (var c = track.clips.numItems - 1; c >= 0; c--) {
                var clip = track.clips[c];
                try {
                    var clipStart = Number(clip.start.seconds);
                    var clipEnd = Number(clip.end.seconds);
                    var midpoint = (clipStart + clipEnd) / 2;

                    if (midpoint >= segment.start - tolerance && midpoint < segment.end - tolerance) {
                        clip.remove(ripple, true);
                        removed++;
                    }
                } catch (eClip) {}
            }
        }
    } catch (eTracks) {}

    return removed;
}

function tryCloseGap(sequence, qeSequence, seconds, fps, logs) {
    var timecode = secToQETimecode(seconds, fps);
    var dropTimecode = secToQEDropTimecode(seconds, fps);

    try {
        if (qeSequence && typeof qeSequence.closeGap === "function") {
            qeSequence.closeGap(timecode);
            logs.push("Ripple delete applied at " + timecode + ".");
            return true;
        }
    } catch (eClose) {
        logs.push("Ripple delete failed at " + timecode + ": " + eClose.message);
    }

    try {
        if (qeSequence && typeof qeSequence.closeGap === "function" && dropTimecode !== timecode) {
            qeSequence.closeGap(dropTimecode);
            logs.push("Ripple delete applied at " + dropTimecode + ".");
            return true;
        }
    } catch (eDropClose) {
        logs.push("Ripple delete fallback failed at " + dropTimecode + ": " + eDropClose.message);
    }

    try {
        if (sequence && typeof sequence.closeGap === "function") {
            sequence.closeGap();
            logs.push("Ripple delete applied.");
            return true;
        }
    } catch (eSeqClose) {
        logs.push("Sequence ripple delete failed: " + eSeqClose.message);
    }

    logs.push("Ripple delete not available for this segment.");
    return false;
}

function uniqueCutPoints(points) {
    var unique = [];
    var tolerance = 0.0005;

    for (var i = 0; i < points.length; i++) {
        if (points[i] <= tolerance) {
            continue;
        }

        if (!unique.length || Math.abs(points[i] - unique[unique.length - 1]) > tolerance) {
            unique.push(points[i]);
        }
    }

    return unique;
}

function applyRazor(qeSequence, seconds, fps, logs) {
    var timecode = secToQETimecode(seconds, fps);
    var fallback = secToQEDropTimecode(seconds, fps);

    try {
        qeSequence.razor(timecode);
        logs.push("Cut applied at " + timecode + ".");
        return true;
    } catch (eColon) {
        logs.push("Cut failed at " + timecode + ": " + eColon.message);
    }

    if (fallback !== timecode) {
        try {
            qeSequence.razor(fallback);
            logs.push("Cut applied at " + fallback + ".");
            return true;
        } catch (eSemi) {
            logs.push("Fallback cut failed at " + fallback + ": " + eSemi.message);
        }
    }

    return false;
}

function applyCutsToSequence(sequenceID, rangesJson, keepOnlyRanges) {
    var logs = [];
    keepOnlyRanges = keepOnlyRanges === true || keepOnlyRanges === "true";

    try {
        if (!app.project) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "No project open."
            });
        }

        var sequence = findSequenceByID(sequenceID);
        if (!sequence) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "Selected sequence was not found."
            });
        }

        var ranges;
        try {
            ranges = JSON.parse(rangesJson);
        } catch (eJson) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "Invalid ranges JSON: " + eJson.message
            });
        }

        if (!isArray(ranges) || !ranges.length) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "No ranges provided."
            });
        }

        logs.push("Selected sequence: " + sequence.name + ".");
        logs.push("Keep only selected ranges: " + (keepOnlyRanges ? "ON" : "OFF") + ".");

        sequence = activateSequence(sequenceID, logs);
        if (!sequence) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "Could not activate selected sequence. Please open it manually in the timeline and try again."
            });
        }

        var fps = getSequenceFPS(sequence);
        logs.push("Sequence FPS: " + fps + ".");

        app.enableQE();

        if (typeof qe === "undefined" || !qe || !qe.project) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "QE API is not available."
            });
        }

        var qeSequence = null;
        try {
            qeSequence = qe.project.getActiveSequence();
        } catch (eQESeq) {
            logs.push("Could not get active QE sequence: " + eQESeq.message);
        }

        if (!qeSequence) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "QE active sequence is not available."
            });
        }

        var cutPoints = collectCutPoints(ranges, fps, logs);
        if (!cutPoints.length) {
            return jsonResult({
                success: false,
                applied: 0,
                expected: 0,
                logs: logs,
                error: "No valid cut points."
            });
        }

        logs.push("Expected cut points: " + cutPoints.length + ".");

        var applied = 0;
        for (var i = 0; i < cutPoints.length; i++) {
            if (applyRazor(qeSequence, cutPoints[i], fps, logs)) {
                applied++;
            }
        }

        logs.push("Cut points applied: " + applied + "/" + cutPoints.length + ".");

        if (keepOnlyRanges && applied !== cutPoints.length) {
            return jsonResult({
                success: false,
                applied: applied,
                expected: cutPoints.length,
                keepOnlyRanges: keepOnlyRanges,
                deleted: 0,
                rippleApplied: 0,
                logs: logs,
                error: "Not all cut points were applied. No timeline sections were deleted."
            });
        }

        var deleteResult = {
            deleted: 0,
            rippleApplied: 0
        };

        if (keepOnlyRanges) {
            var keepRanges = normalizeRanges(ranges, fps, logs);
            var sequenceEnd = getSequenceEndSeconds(sequence);
            var outsideSegments = getOutsideSegments(keepRanges, sequenceEnd, logs, fps);

            if (outsideSegments.length) {
                deleteResult = removeOutsideSegments(sequence, qeSequence, outsideSegments, fps, logs);
            } else {
                logs.push("No outside segments to delete.");
            }
        }

        return jsonResult({
            success: applied > 0,
            applied: applied,
            expected: cutPoints.length,
            keepOnlyRanges: keepOnlyRanges,
            deleted: deleteResult.deleted,
            rippleApplied: deleteResult.rippleApplied,
            logs: logs,
            error: applied > 0 ? "" : "Could not apply any cuts."
        });
    } catch (e) {
        return jsonResult({
            success: false,
            applied: 0,
            expected: 0,
            logs: logs,
            error: e.message
        });
    }
}
