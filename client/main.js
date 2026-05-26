var csInterface = new CSInterface();
var ranges = [];
var nextRangeId = 1;

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("btn-refresh").addEventListener("click", loadSequences);
    document.getElementById("btn-add-range").addEventListener("click", addRange);
    document.getElementById("btn-apply").addEventListener("click", onApply);
    document.getElementById("btn-clear-log").addEventListener("click", clearLog);
    document.getElementById("seq-select").addEventListener("change", updateApplyState);

    addRange();
    updateApplyState();
    loadSequences();
    logInfo("Timestamp Cutter loaded.");
});

function updateApplyState() {
    document.getElementById("btn-apply").disabled = !document.getElementById("seq-select").value;
}

function loadSequences() {
    var select = document.getElementById("seq-select");
    var previousValue = select.value;

    logInfo("Loading sequences...");

    csInterface.evalScript("getSequenceList()", function (result) {
        var data;

        try {
            data = JSON.parse((result || "").trim());
        } catch (e) {
            select.innerHTML = '<option value="">Could not load sequences</option>';
            updateApplyState();
            logError("Could not read sequence list.");
            return;
        }

        if (data && data.error) {
            select.innerHTML = '<option value="">No project open</option>';
            updateApplyState();
            logError(data.error);
            return;
        }

        if (!data || !data.length) {
            select.innerHTML = '<option value="">No sequences found</option>';
            updateApplyState();
            logWarn("No sequences found.");
            return;
        }

        select.innerHTML = '<option value="">Select Sequence</option>';
        for (var i = 0; i < data.length; i++) {
            var option = document.createElement("option");
            option.value = data[i].id;
            option.textContent = data[i].name;
            select.appendChild(option);
        }

        if (previousValue) {
            select.value = previousValue;
        }

        updateApplyState();
        logSuccess("Found " + data.length + " sequence(s).");
    });
}

function addRange() {
    var container = document.getElementById("ranges-container");
    var id = nextRangeId++;

    var row = document.createElement("div");
    row.className = "range-row";
    row.setAttribute("data-range-id", id);

    var start = document.createElement("input");
    start.type = "text";
    start.placeholder = "Start Time";
    start.setAttribute("aria-label", "Start Time");

    var end = document.createElement("input");
    end.type = "text";
    end.placeholder = "End Time";
    end.setAttribute("aria-label", "End Time");

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", function () {
        row.parentNode.removeChild(row);
        ranges = ranges.filter(function (range) {
            return range.id !== id;
        });

        if (!ranges.length) {
            addRange();
        }
    });

    row.appendChild(start);
    row.appendChild(end);
    row.appendChild(remove);
    container.appendChild(row);

    ranges.push({ id: id, start: start, end: end });
    start.focus();
}

function collectRanges() {
    var items = [];

    for (var i = 0; i < ranges.length; i++) {
        var start = trimValue(ranges[i].start.value);
        var end = trimValue(ranges[i].end.value);

        if (!start && !end) {
            continue;
        }

        if (!start || !end) {
            return { error: "Each range must include Start Time and End Time." };
        }

        items.push({ start: start, end: end });
    }

    if (!items.length) {
        return { error: "Add at least one time range." };
    }

    return { ranges: items };
}

function trimValue(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "");
}

function onApply() {
    var select = document.getElementById("seq-select");
    var sequenceID = select.value;
    var sequenceName = select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : "";
    var collected = collectRanges();
    var keepOnlyRanges = document.getElementById("keep-only-ranges").checked;
    var confirmMessage = keepOnlyRanges ?
        "This will delete all timeline sections outside the selected ranges. This action cannot be automatically undone by the plugin. Continue?" :
        "This will apply cuts directly to the selected sequence. Continue?";

    if (!sequenceID) {
        logError("Select a sequence first.");
        return;
    }

    if (collected.error) {
        logError(collected.error);
        return;
    }

    if (!confirm(confirmMessage)) {
        logWarn("Operation cancelled.");
        return;
    }

    setBusy(true);
    logInfo("Applying cuts to \"" + sequenceName + "\"...");
    logInfo("Keep only selected ranges: " + (keepOnlyRanges ? "ON" : "OFF"));

    var rangesJson = JSON.stringify(collected.ranges);
    var script = "applyCutsToSequence(" + JSON.stringify(sequenceID) + ", " + JSON.stringify(rangesJson) + ", " + (keepOnlyRanges ? "true" : "false") + ")";

    csInterface.evalScript(script, function (result) {
        setBusy(false);
        handleApplyResult(result);
    });
}

function setBusy(isBusy) {
    var button = document.getElementById("btn-apply");
    button.disabled = isBusy || !document.getElementById("seq-select").value;
    button.textContent = isBusy ? "Applying..." : "Apply Cuts";
}

function handleApplyResult(result) {
    var data;

    try {
        data = JSON.parse((result || "").trim());
    } catch (e) {
        logError("Could not parse host response.");
        return;
    }

    if (data.logs && data.logs.length) {
        for (var i = 0; i < data.logs.length; i++) {
            logInfo(data.logs[i]);
        }
    }

    if (data.success) {
        logSuccess("Cuts applied: " + data.applied + "/" + data.expected + ".");
        if (data.keepOnlyRanges) {
            logSuccess("Deleted outside clips: " + (data.deleted || 0) + ".");
        }
    } else {
        logError(data.error || "Could not apply cuts.");
    }
}

function logLine(message, className) {
    var log = document.getElementById("log");
    var empty = log.querySelector(".log-empty");

    if (empty) {
        empty.parentNode.removeChild(empty);
    }

    var line = document.createElement("div");
    line.className = "log-line " + className;
    line.textContent = message;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

function logInfo(message) {
    logLine(message, "log-info");
}

function logSuccess(message) {
    logLine(message, "log-success");
}

function logWarn(message) {
    logLine(message, "log-warn");
}

function logError(message) {
    logLine(message, "log-error");
}

function clearLog() {
    document.getElementById("log").innerHTML = '<span class="log-empty">Waiting...</span>';
}
