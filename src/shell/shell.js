

const URL = 'http://localhost:3000';
const prefix = "remote@terminal:~$ ";
const prefixspan = document.getElementById('prefix');
const outputarea = document.getElementById('outputArea');
const commandInput = document.getElementById('commandInput');

prefixspan.innerText = prefix;

const help = "- Available commands:<br> - help: Display this help message<br>- clear: Clear the terminal output<br>- log-out: Log out of the remote shell<br>- end-session: End the current session<br>- list-devices: list all devices associated with your account<br>- end-session: End the current session<br>- log-in log in to your account";
const loginmsg = "you are not logged in to any account <br> please enter an email to be verified.";

outputarea.innerHTML = help;

// Global State
let terminalState = 'COMMAND'; 
let tempEmail = ''; 

// --- INITIALIZATION ---
function checkfortoken() {
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('email');
    if (token && email) {
        prefixspan.innerText = `${email}@terminal:~$ `;
        outputarea.innerHTML += `<br><br>Logged in as: ${email}`;
        terminalState = 'COMMAND';
    } else {
        outputarea.innerHTML += "<br><br>" + loginmsg;
        terminalState = 'LOGIN_EMAIL';
    }
}

// --- SINGLE GLOBAL LISTENER ---
commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const inputVal = commandInput.value.trim();
        const currentPrefix = prefixspan.innerText;
        
        // Echo the command to the terminal
        if (inputVal) {
            outputarea.innerHTML += `<br><br>${currentPrefix}${inputVal}`;
        }
        commandInput.value = '';

        if (!inputVal) return;

        // Route based on state
        switch (terminalState) {
            case 'COMMAND':
                commandchecker(inputVal);
                break;
            case 'LOGIN_EMAIL':
                handleLoginSubmit(inputVal);
                break;
            case 'VERIFY_CODE':
                handleVerifySubmit(inputVal);
                break;
            case 'SELECT_DEVICE':
                handleDeviceSelection(inputVal);
                break;
        }
        
        // Auto-scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
    }
});

// --- COMMAND LOGIC ---
function commandchecker(command) {
    switch (command) {
        case 'help':
            outputarea.innerHTML += "<br><br>" + help;
            break;
        case 'clear':
            outputarea.innerHTML = '';
            break;
        case 'list-devices':
            outputarea.innerHTML += "<br>Fetching your devices...";
            getapiKeys();
            break;
        case 'log-out':
            localStorage.clear();
            location.reload();
            prefixspan.innerText = prefix;
            break;
        case 'end-session':
          localStorage.setItem('DeviceID', '');
          location.reload();
          prefixspan.innerText = localStorage.getItem('email') + "@terminal:~$ ";
            break;
        case 'log-in':
            outputarea.innerHTML += "<br><br>" + loginmsg;
            terminalState = 'LOGIN_EMAIL';
            break;
        default:
          if(localStorage.getItem('DeviceID') === '') outputarea.innerHTML += "<br><span style='color:red'>No device connected. Please select a device using the list-devices command.</span>";
           else{ sendCommandToDevice(command);}
            break;
    }
}

// --- AUTH LOGIC ---
function handleLoginSubmit(userEmail) {
    fetch(`${URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
    })
    .then(res => res.json())
    .then(() => {
        tempEmail = userEmail;
        outputarea.innerHTML += "<br><br>Verification email sent. Type the 6-digit code here.";
        terminalState = 'VERIFY_CODE';
    })
    .catch(err => console.error('Error:', err));
}

function handleVerifySubmit(code) {
    fetch(`${URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempEmail, code: code }),
    })
    .then(res => res.json())
    .then(data => {
        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('email', data.user.email);
            prefixspan.innerText = data.user.email + "@terminal:~$ ";
            outputarea.innerHTML += "<br><br>Logged in as: " + data.user.email;
            terminalState = 'COMMAND';
        } else {
            outputarea.innerHTML += "<br><br><span style='color:red'>Invalid code.</span>";
        }
    });
}

// --- DEVICE LOGIC (Using isActive boolean) ---
function getapiKeys() {
    const token = localStorage.getItem('token');
    fetch(`${URL}/api/auth/api-keys`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    })
    .then(res => res.json())
    .then(data => {
        const apiKeys = data.apiKeys || [];
        localStorage.setItem('apikeys', JSON.stringify(apiKeys));
        
        let listHTML = "<br>Please input the device index to connect to it:";
        
        for (let i = 0; i < apiKeys.length; i++) {
            const device = apiKeys[i];
            // Using isActive from the response
            const statusText = device.isActive ? 
                'online': 
                'offline';
            
            listHTML += `<br>${i} - Device Name: ${device.deviceName}, status: ${statusText}`;
        }

        outputarea.innerHTML += listHTML;
        terminalState = 'SELECT_DEVICE';
    })
    .catch(err => {
        outputarea.innerHTML += "<br>Error fetching devices.";
        console.error(err);
    });
}

function handleDeviceSelection(val) {
    const apiKeys = JSON.parse(localStorage.getItem('apikeys')) || [];
    const index = parseInt(val);

    if (isNaN(index) || !apiKeys[index]) {
        outputarea.innerHTML += "<br><span style='color:red'>Invalid index. Device selection cancelled.</span>";
        terminalState = 'COMMAND';
        return;
    }
    if (!apiKeys[index].isActive) {
        outputarea.innerHTML += "<br><span style='color:red'>Selected device is offline. Cannot connect.</span>";
        terminalState = 'COMMAND';
        return;
    }
    const selectedDevice = apiKeys[index];
    localStorage.setItem('DeviceID', selectedDevice.deviceID);
    prefixspan.innerText = `${selectedDevice.deviceName}@terminal:~$ `;
    outputarea.innerHTML += `<br>Connected to ${selectedDevice.deviceName}`;
    
    // Return to command mode to start using the connected device
    terminalState = 'COMMAND';
}
function sendCommandToDevice(command) {
    const token = localStorage.getItem('token');
    const deviceId = localStorage.getItem('DeviceID');
    const email = localStorage.getItem('email');
    const user = {email};
    fetch(`${URL}/api/master/command/send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId, command, user }),
    })
    .then(res => res.json())
    .then(data => {
        console.log(data.message);
        getCommandResult(data.commandId);
    })
    .catch(err => {
        outputarea.innerHTML += "<br><span style='color:red'>Error sending command.</span>";
        console.error(err);
    });
}
function getCommandResult(commandId) {
    const token = localStorage.getItem('token');
    const pollInterval = 2000; // 2 seconds
    const maxAttempts = 10; // 20 seconds total
    let attempts = 0;
    
    const pollFunction = () => {
        if (attempts >= maxAttempts) {
            outputarea.innerHTML += "<br><span style='color:red'>Polling timeout - command result not available.</span>";
            clearInterval(intervalId);
            return;
        }
        
        // FIXED: Correct URL and method
        fetch(`${URL}/api/master/command/${commandId}`, {
            method: 'GET',  // FIXED: Changed from POST to GET
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            // REMOVED: body parameter for GET request
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            attempts++; // Count this as an attempt
            
            if (data.success) {
                const command = data.command;
                
                // Check if command is completed
                if (command.status === 'completed' && command.result) {
                    outputarea.innerHTML += `<br>${command.result}`;
                    clearInterval(intervalId);
                } else if (command.status === 'pending') {
                    console.log('Command status: pending');
                } else {
                    command.status = 'error';
                    console.log('Command status: error');
                }
            } else {
                outputarea.innerHTML += `<br>Error: ${data.message}`;
                clearInterval(intervalId);
            }
        })
        .catch(err => {
            attempts++; // Count this as an attempt
            outputarea.innerHTML += `<br>Error fetching result (attempt ${attempts}/${maxAttempts}): ${err.message}`;
            console.error(err);
        });
    };
    
    // Start polling
    const intervalId = setInterval(pollFunction, pollInterval);

    pollFunction();
}
// Initialize the app
checkfortoken();