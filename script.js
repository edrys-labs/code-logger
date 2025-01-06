// DOM elements 
const mainContainer = document.querySelector('.main');
const startLogger = document.getElementById('start-logger');
const loadLogsFromDB = document.getElementById('load-logs-from-db');
const loadLogsFromFile = document.getElementById('load-logs-from-file');

const logsContainer = document.querySelector('.logs');
const stopLogger = document.getElementById('stop-logger');
const clearLogger = document.getElementById('clear-logger');
const downloadLogs = document.getElementById('download-logs');
const backToMain = document.getElementById('back-to-main');

const logsModal = document.getElementById('logs-modal');
const logsSelect = document.getElementById('logs-select');
const closeModalButton = document.getElementById('close-modal');
const loadLog = document.getElementById('load-log');
const loadError = document.getElementById('load-error');

const scrollUpButton = document.getElementById('scroll-up');

// Logger variables
let isLoggingEnabled = false;
let logsDate = null;
let isLoadError = false;

Edrys.onReady(() => {
    console.log('Code Logger is ready!');
});

let studentsSubmissions = []; // To store the code submissions

// Listen for code submissions
Edrys.onMessage(({ from, subject, body }) => {
    if (subject === 'execute' && isLoggingEnabled) {
        const newEntry = {
            From: from,
            Date: new Date().toLocaleString(),
            Code: body
        };

        studentsSubmissions.push(newEntry);

        renderSubmissions();
        storeLogInIndexedDB();
    }
}, (promiscuous = true));

// Display the code submissions
function renderSubmissions() {
    const submissionsContainer = document.querySelector('.students-submissions');
    submissionsContainer.innerHTML = '';

    studentsSubmissions.forEach((submission) => {
        const submissionElement = document.createElement('div');
        submissionElement.classList.add('submission-wrapper');

        submissionElement.innerHTML = `
            <div class="student-info">
                <div>
                    <p>From: <span>${submission.From}</span></p>
                </div>
                <div>
                    <p>Date: <span>${submission.Date}</span></p>
                </div>
            </div>
            <div class="student-code">
                <p>Code:</p>
                <pre><code class="language-cpp">${escapeHTML(submission.Code)}</code></pre>
            </div>
        `;

        submissionsContainer.appendChild(submissionElement);
    });

    // Highlight the code
    Prism.highlightAll();
};

// Escape HTML characters
function escapeHTML(code) {
    return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Logger Main Buttons Handlers
startLogger.onclick = () => {
    isLoggingEnabled = true;
    logsDate = new Date().toLocaleString();

    stopLogger.disabled = false;
    clearLogger.disabled = true;
    backToMain.disabled = true;

    mainContainer.classList.add('hidden');
    logsContainer.classList.remove('hidden');
}

stopLogger.onclick = () => {
    isLoggingEnabled = false;
    clearLogger.disabled = false;
    backToMain.disabled = false;
};

clearLogger.onclick = () => {
    downloadLogs.disabled = true;
    studentsSubmissions = [];
    renderSubmissions();
};

downloadLogs.onclick = () => {
    const blob = new Blob([JSON.stringify(studentsSubmissions)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const username = Edrys.username.split('_')[0];
    const stationName = Edrys.liveUser.room;

    const a = document.createElement('a');
    a.href = url;
    a.download = `CodeLog_User: ${username}_${stationName}_Date: ${logsDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

backToMain.onclick = () => {
    studentsSubmissions = [];
    renderSubmissions();

    mainContainer.classList.remove('hidden');
    logsContainer.classList.add('hidden');
};


// Store log in IndexedDB
function storeLogInIndexedDB() {
    const username = Edrys.username.split('_')[0];
    const stationName = Edrys.liveUser.room;

    db.logs.put({ id: `User: ${username}_${stationName}_Date: ${logsDate}`, studentsSubmissions: studentsSubmissions });
};

// Load logs from IndexedDB for the select field
function loadLogsIntoModal() {
    const username = Edrys.username;

    // Create the unique prefix for the current user 
    const currentUserPrefix = `User: ${username}`.split('_')[0];

    db.logs.toArray().then((allLogs) => {
        logsSelect.innerHTML = '<option value="" disabled selected>Choose a log</option>';

        const userLogs = allLogs.filter(log => log.id.startsWith(currentUserPrefix));

        userLogs.forEach((log, index) => {
            const option = document.createElement('option');

            // Extract station and date from the id
            const [_, stationAndDate] = log.id.split(`${currentUserPrefix}_`);
            option.value = log.id;
            option.textContent = stationAndDate;
            logsSelect.appendChild(option);
        });

        if (userLogs.length === 0) {
            const noLogsOption = document.createElement('option');
            noLogsOption.textContent = "No logs available for this user.";
            noLogsOption.disabled = true;
            logsSelect.appendChild(noLogsOption);
        }
    });
};

// Load log from IndexedDB
function loadLogFromDB() {
    const selectedLogId = logsSelect.value;

    // Check if a log is selected
    if (!selectedLogId) {
        isLoadError = true;
        loadError.textContent = "Please select a log.";
        return;
    }

    // Fetch the log from IndexedDB
    db.logs.get(selectedLogId)
        .then((log) => {
            if (!log) {
                isLoadError = true;
                loadError.textContent = "Log not found.";
                return;
            }

            // Update submissions array and render
            studentsSubmissions = log.studentsSubmissions;
            renderSubmissions();

            // Extract the date from the id (to be used for download)
            logsDate = selectedLogId.split('_Date: ').pop();

            // No errors, hide modal and show logs container
            isLoadError = false;
            logsModal.classList.add('hidden');
            mainContainer.classList.add('hidden');
            logsContainer.classList.remove('hidden');
            loadError.textContent = "";

            stopLogger.disabled = true;
        })
        .catch((error) => {
            isLoadError = true;
            loadError.textContent = "An error occurred while loading the log.";
            console.error("Error loading log:", error);
        });
};


// Load Modal Handlers
loadLogsFromDB.onclick = () => {
    loadLogsIntoModal();
    logsModal.classList.remove('hidden');
};

closeModalButton.onclick = () => {
    loadError.textContent = "";
    logsModal.classList.add('hidden');
};

loadLog.onclick = () => {
    loadLogFromDB();
};

// Load logs from file
loadLogsFromFile.onclick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.click();

    fileInput.onchange = () => {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const logs = JSON.parse(reader.result);

                studentsSubmissions = logs;
                renderSubmissions();

                mainContainer.classList.add('hidden');
                logsContainer.classList.remove('hidden');
                stopLogger.disabled = true;
            } catch (error) {
                alert("Invalid file format. Please upload a valid JSON file.");
            }
        };

        reader.readAsText(file);
    };
};


// Handle scroll up 
window.onscroll = () => {
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        scrollUpButton.style.display = 'block';
    } else {
        scrollUpButton.style.display = 'none';
    }
};

scrollUpButton.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};


// Database implementation
var db = new Dexie("CodeLogger");

db.version(1).stores({
    logs: 'id'
});