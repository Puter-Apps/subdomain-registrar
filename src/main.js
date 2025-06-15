// (function(){
//     // Only redirect if we're not in an iframe and on the wrong URL
//     if (window.self === window.top && !window.location.href.startsWith('https://puter.com/app/')){
//         window.location.href='https://puter.com/app/subdomain-registrar';
//     }
// })();

let currentDomain = '';
let approvedParentPath = null;
let isAvailable = false;
let isRegistering = false;
let debounceTimeout;

const elements = {
    subdomainInput: document.getElementById('subdomainInput'),
    statusMessage: document.getElementById('statusMessage'),
    registerButton: document.getElementById('registerButton'),
    successSection: document.getElementById('successSection'),
    siteLink: document.getElementById('siteLink'),
    folderButton: document.getElementById('folderButton'),
    userInfo: document.getElementById('userInfo'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    toast: document.getElementById('toast'),
    // New UI elements
    folderStep: document.getElementById('folderStep'),
    subdomainStep: document.getElementById('subdomainStep'),
    mainSelectFolderButton: document.getElementById('mainSelectFolderButton'),
    hostingPath: document.getElementById('hostingPath'),
    changeFolderLink: document.getElementById('changeFolderLink'),
};

function showToast(message, duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => elements.toast.classList.remove('show'), duration);
}

async function updateAuthUI() {
    // puter.auth.isSignedIn() - Checks if a user is currently authenticated with Puter
    // Returns a boolean value without requiring any network requests
    const isSignedIn = puter.auth.isSignedIn();
    if (isSignedIn) {
        // puter.auth.getUser() - Fetches the current user's profile information
        // Returns a Promise that resolves to a user object containing username, email, etc.
        const user = await puter.auth.getUser();
        elements.userInfo.textContent = user.username;
        elements.loginButton.style.display = 'none';
        elements.logoutButton.style.display = 'inline-block';
        elements.folderButton.style.display = 'inline-block';
        await loadSavedFolder();
    } else {
        elements.userInfo.textContent = 'Not signed in';
        elements.loginButton.style.display = 'inline-block';
        elements.logoutButton.style.display = 'none';
        elements.folderButton.style.display = 'none';
        approvedParentPath = null;
        updateView();
    }
}

function updateView() {
    // puter.auth.isSignedIn() - Checks authentication status without network requests
    // Used here to conditionally render UI elements based on login state
    const isSignedIn = puter.auth.isSignedIn();

    if (!isSignedIn) {
        elements.folderStep.style.display = 'block';
        elements.subdomainStep.style.display = 'none';
        elements.mainSelectFolderButton.disabled = true;
        elements.mainSelectFolderButton.textContent = 'Sign In to Select Folder';
        return;
    }
    
    elements.mainSelectFolderButton.disabled = false;
    elements.mainSelectFolderButton.textContent = 'Select Folder';

    if (approvedParentPath) {
        elements.folderStep.style.display = 'none';
        elements.subdomainStep.style.display = 'block';
        elements.hostingPath.textContent = approvedParentPath;
        elements.folderButton.innerHTML = '<i class="fas fa-folder"></i> Change Folder';
        elements.registerButton.disabled = !isAvailable || isRegistering;
    } else {
        elements.folderStep.style.display = 'block';
        elements.subdomainStep.style.display = 'none';
        elements.folderButton.innerHTML = '<i class="fas fa-folder"></i> Select Folder';
        elements.registerButton.disabled = true;
    }
}

async function handleLogin() {
    try {
        // puter.auth.signIn() - Opens the Puter authentication dialog
        // Returns a Promise that resolves when user successfully authenticates
        // The dialog handles the entire auth flow including account creation
        await puter.auth.signIn();
        await updateAuthUI();
        showToast('Successfully signed in!');
    } catch (error) {
        showToast('Login failed. Please try again.');
    }
}

function handleLogout() {
    // puter.auth.signOut() - Logs the current user out of Puter
    // Clears authentication tokens and session data
    // Returns immediately (not async) as it's just clearing local state
    puter.auth.signOut();
    approvedParentPath = null;
    updateAuthUI();
    showToast('Signed out successfully');
}

async function saveFolderPath(path) {
    try {
        if (puter.auth.isSignedIn()) {
            // puter.kv.set() - Stores a key-value pair in Puter's cloud storage
            // Perfect for saving user preferences and app state that persists across sessions
            // Data is tied to the user's account and available on any device
            await puter.kv.set('selectedFolderPath', path);
        } else {
            localStorage.setItem('selectedFolderPath', path);
        }
    } catch (error) {
        console.error('Error saving folder path:', error);
        showToast('Failed to save folder choice');
    }
}

async function loadSavedFolder() {
    let savedPath = null;
    try {
        if (puter.auth.isSignedIn()) {
            // puter.kv.get() - Retrieves a value from Puter's cloud key-value storage
            // Returns a Promise that resolves to the stored value or null if not found
            // Used here to restore user's previously selected folder path
            savedPath = await puter.kv.get('selectedFolderPath');
        }
        if (!savedPath) {
            savedPath = localStorage.getItem('selectedFolderPath');
        }
        if (savedPath) {
            approvedParentPath = savedPath;
        }
    } catch (error) {
        console.error('Error loading folder path:', error);
        showToast('Failed to load saved folder choice');
    } finally {
        updateView();
    }
}

async function selectFolder() {
    try {
        // puter.ui.showDirectoryPicker() - Opens Puter's folder selection dialog
        // Returns a Promise that resolves to an object containing the selected directory's metadata
        // The dialog shows the user's Puter drive and allows navigation and folder selection
        const directory = await puter.ui.showDirectoryPicker();
        if (directory && directory.path) {
            approvedParentPath = directory.path;
            await saveFolderPath(directory.path);
            showToast('Folder selected and saved!');
            updateView();
        }
    } catch (error) {
        console.error('Folder selection error:', error);
        if (error.name !== 'AbortError') {
            showToast('Failed to select folder: ' + error.message);
        }
    }
}

function validateDomain(domain) {
    if (!domain) return 'Please enter a subdomain name';
    if (domain.length > 63) return 'Domain name too long (max 63 characters)';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]?$/.test(domain)) {
        return 'Domain can only contain lowercase letters, numbers, and hyphens';
    }
    return null;
}

async function checkAvailability() {
    const domain = elements.subdomainInput.value.trim().toLowerCase();
    currentDomain = domain;
    elements.statusMessage.style.display = 'block';

    const validationError = validateDomain(domain);
    if (validationError) {
        elements.statusMessage.textContent = validationError;
        elements.statusMessage.className = 'status-message taken';
        isAvailable = false;
    } else {
        elements.statusMessage.textContent = 'Checking availability...';
        elements.statusMessage.className = 'status-message checking';
        try {
            const response = await fetch(`https://${domain}.puter.site/`);
            const text = await response.text();
            isAvailable = text.includes('Subdomain not found');
            elements.statusMessage.textContent = isAvailable 
                ? `${domain}.puter.site is available!`
                : `${domain}.puter.site is already taken`;
            elements.statusMessage.className = `status-message ${isAvailable ? 'available' : 'taken'}`;
        } catch (error) {
            console.error('Availability check error:', error);
            elements.statusMessage.textContent = 'Error checking availability';
            elements.statusMessage.className = 'status-message taken';
            isAvailable = false;
        }
    }
    updateView();
}

function generateLandingPageContent(domain) {
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to ${domain}.puter.site</title>
<style>
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #f0f4f8, #d9e2ec); min-height: 100vh; display: flex; justify-content: center; align-items: center; color: #1f2a44; }
.container { text-align: center; background: white; padding: 40px; border-radius: 15px; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1); animation: fadeIn 0.5s ease; max-width: 700px; width: 90%; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
h1 { font-size: 36px; font-weight: 700; margin-bottom: 20px; }
p { font-size: 18px; color: #6b7280; margin-bottom: 30px; }
.button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 10px; font-size: 16px; transition: background 0.3s ease, transform 0.2s; }
.button:hover { background: #2563eb; transform: scale(1.05); }
.attribution { margin-top: 40px; padding: 15px; font-size: 16px; font-weight: 500; background-color: #f0f9ff; border: 2px solid #bae6fd; border-radius: 8px; color: #0369a1; }
.attribution a { color: #0284c7; text-decoration: none; font-weight: 600; }
.attribution a:hover { text-decoration: underline; }
.instructions { margin-top: 30px; padding: 20px; background-color: #fffbeb; border: 2px solid #fcd34d; border-radius: 8px; text-align: left; }
.instructions h3 { margin-top: 0; margin-bottom: 15px; color: #92400e; font-weight: 600; }
.instructions p { font-size: 15px; color: #78350f; margin-bottom: 15px; }
.instructions ul { margin: 0; padding-left: 20px; }
.instructions li { color: #78350f; margin-bottom: 8px; font-size: 15px; }
.instructions code { background-color: #fef3c7; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
</style>
</head>
<body>
<div class="container">
<h1>Welcome to ${domain}.puter.site</h1>
<p>Your new subdomain is live! Start building your amazing project here.</p>
<a href="https://puter.com" class="button">Learn More About Puter</a>
<div class="instructions">
    <h3>How to Edit Your Site</h3>
    <p>Your site files are located in the folder you selected during registration:</p>
    <ul>
        <li>Navigate to your selected folder in the Puter file manager.</li>
        <li>Find the <code>${domain}</code> subfolder created by this app.</li>
        <li>Edit the <code>index.html</code> file to customize your site.</li>
        <li>Add more files as needed—they'll automatically appear on your site.</li>
    </ul>
    <p>All changes save automatically and will be immediately visible on your live site!</p>
</div>
<div class="attribution">
    Register yours at <a href="https://puter.com/app/subdomain-registrar" target="_blank">Puter Subdomain Registrar</a>
</div>
</div>
</body>
</html>`;
}

async function registerSubdomain() {
    if (!currentDomain || !approvedParentPath || !isAvailable) {
        showToast('Please select a folder and ensure the subdomain is available');
        return;
    }

    if (isRegistering) return;
    isRegistering = true;
    elements.registerButton.classList.add('loading');
    elements.registerButton.disabled = true;

    try {
        const targetPath = `${approvedParentPath}/${currentDomain}`;
        // puter.fs.mkdir() - Creates a new directory in the user's Puter drive
        // The dedupeName option automatically handles name conflicts by appending a number
        // Returns a Promise that resolves to the created directory's metadata
        await puter.fs.mkdir(targetPath, { dedupeName: true });
        const htmlContent = generateLandingPageContent(currentDomain);
        // puter.fs.write() - Creates or overwrites a file with the specified content
        // First parameter is the full path to the file
        // Second parameter is the content to write (string, ArrayBuffer, or Blob)
        // Returns a Promise that resolves when the write operation completes
        await puter.fs.write(`${targetPath}/index.html`, htmlContent);
        // puter.hosting.create() - Creates a new subdomain and links it to a directory
        // First parameter is the subdomain name (without .puter.site)
        // Second parameter is the path to the directory containing website files
        // Returns a Promise with the hosting configuration details
        const subdomain = await puter.hosting.create(currentDomain, targetPath);

        const siteUrl = `https://${currentDomain}.puter.site`;
        elements.siteLink.href = siteUrl;
        elements.siteLink.textContent = siteUrl;
        elements.successSection.style.display = 'block';
        elements.successSection.scrollIntoView({ behavior: 'smooth' });
        showToast('Subdomain registered successfully!');
    } catch (error) {
        console.error('Registration error:', error);
        showToast(`Failed to register subdomain: ${error.message}`);
    } finally {
        isRegistering = false;
        elements.registerButton.classList.remove('loading');
        updateView();
    }
}

// Event Listeners
elements.loginButton.addEventListener('click', handleLogin);
elements.logoutButton.addEventListener('click', handleLogout);
elements.folderButton.addEventListener('click', selectFolder);
elements.mainSelectFolderButton.addEventListener('click', selectFolder);
elements.changeFolderLink.addEventListener('click', (e) => {
    e.preventDefault();
    selectFolder();
});
elements.registerButton.addEventListener('click', registerSubdomain);
elements.subdomainInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(checkAvailability, 300);
});

// Initial Load
updateAuthUI();