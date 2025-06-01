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
    selectedFolder: document.getElementById('selectedFolder'),
    userInfo: document.getElementById('userInfo'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    toast: document.getElementById('toast')
};

function showToast(message, duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => elements.toast.classList.remove('show'), duration);
}

async function updateAuthUI() {
    /*
    * Checks whether the current user is signed in using Puter's authentication system.
    * Commonly used to conditionally show or hide UI elements based on auth state.
    */
    const isSignedIn = puter.auth.isSignedIn();
    if (isSignedIn) {
        // Fetch current user information from Puter SDK
        const user = await puter.auth.getUser();
        elements.userInfo.textContent = user.username;
        elements.loginButton.style.display = 'none';
        elements.logoutButton.style.display = 'inline-block';
        elements.subdomainInput.disabled = false;
        // Load saved folder choice on login
        await loadSavedFolder();
    } else {
        elements.userInfo.textContent = 'Not signed in';
        elements.loginButton.style.display = 'inline-block';
        elements.logoutButton.style.display = 'none';
        elements.subdomainInput.disabled = true;
        approvedParentPath = null;
        elements.selectedFolder.textContent = 'No folder selected';
    }
    updateUI();
}

async function handleLogin() {
    try {
        /*
        * Initiates the Puter authentication sign-in flow using a popup.
        * Useful for manually controlling when the user signs in.
        */
        await puter.auth.signIn();
        await updateAuthUI();
        showToast('Successfully signed in!');
    } catch (error) {
        showToast('Login failed. Please try again.');
    }
}

function handleLogout() {
    /*
    * Signs the user out from the Puter session.
    * This will terminate access to Puter services for the user.
    */
    puter.auth.signOut();
    updateAuthUI();
    showToast('Signed out successfully');
}

async function saveFolderPath(path) {
    try {
/*
* Checks whether the user is currently signed into their Puter account
* Allows conditional logic based on user authentication status
*/
        if (puter.auth.isSignedIn()) {
    /*
    * Stores a value in the user's private key-value store (kv).
    * The value is associated with a key ('selectedFolderPath') and can be retrieved later.
    * This is useful for persisting user preferences or state.
    */
            await puter.kv.set('selectedFolderPath', path);
            console.log('Folder path saved to puter.kv:', path);
        } else {
            // Fallback to localStorage if not signed in
            localStorage.setItem('selectedFolderPath', path);
            console.log('Folder path saved to localStorage:', path);
        }
    } catch (error) {
        console.error('Error saving folder path:', error);
        showToast('Failed to save folder choice');
    }
}

async function loadSavedFolder() {
    try {
        let savedPath = null;
        // Check if user is signed in before trying to access Puter KV store
        if (puter.auth.isSignedIn()) {
            /*
            * Retrieves the previously saved folder path from Puter's key-value storage
            * Enables restoring the user's selection if they are signed in
            */
            savedPath = await puter.kv.get('selectedFolderPath');
            console.log('Folder path loaded from puter.kv:', savedPath);
        }
        if (!savedPath) {
            // Fallback to localStorage if not found in puter.kv
            savedPath = localStorage.getItem('selectedFolderPath');
            console.log('Folder path loaded from localStorage:', savedPath);
        }
        if (savedPath) {
            approvedParentPath = savedPath;
            elements.selectedFolder.textContent = `📁 ${savedPath}`;
            updateUI();
        }
    } catch (error) {
        console.error('Error loading folder path:', error);
        showToast('Failed to load saved folder choice');
    }
}

async function selectFolder() {
    try {
        /*
        * Opens a directory picker interface to allow the user to select a folder.
        * Returns a directory object containing the selected folder's path.
        */
        const directory = await puter.ui.showDirectoryPicker();
        if (directory && directory.path) {
            approvedParentPath = directory.path;
            elements.selectedFolder.textContent = `📁 ${directory.path}`;
            await saveFolderPath(directory.path);
            showToast('Folder selected and saved!');
            updateUI();
        }
    } catch (error) {
        console.error('Folder selection error:', error);
        showToast('Failed to select folder: ' + error.message);
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
    updateUI();
}

function generateLandingPageContent(domain) {
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to ${domain}.puter.site</title>
<style>
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 0;
    padding: 0;
    background: linear-gradient(135deg, #f0f4f8, #d9e2ec);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #1f2a44;
}
.container {
    text-align: center;
    background: white;
    padding: 40px;
    border-radius: 15px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    animation: fadeIn 0.5s ease;
    max-width: 700px;
    width: 90%;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
h1 {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 20px;
}
p {
    font-size: 18px;
    color: #6b7280;
    margin-bottom: 30px;
}
.button {
    display: inline-block;
    padding: 12px 24px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 10px;
    font-size: 16px;
    transition: background 0.3s ease, transform 0.2s;
}
.button:hover {
    background: #2563eb;
    transform: scale(1.05);
}
.attribution {
    margin-top: 40px;
    padding: 15px;
    font-size: 16px;
    font-weight: 500;
    background-color: #f0f9ff;
    border: 2px solid #bae6fd;
    border-radius: 8px;
    color: #0369a1;
}
.attribution a {
    color: #0284c7;
    text-decoration: none;
    font-weight: 600;
}
.attribution a:hover {
    text-decoration: underline;
}
.instructions {
    margin-top: 30px;
    padding: 20px;
    background-color: #fffbeb;
    border: 2px solid #fcd34d;
    border-radius: 8px;
    text-align: left;
}
.instructions h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #92400e;
    font-weight: 600;
}
.instructions p {
    font-size: 15px;
    color: #78350f;
    margin-bottom: 15px;
}
.instructions ul {
    margin: 0;
    padding-left: 20px;
}
.instructions li {
    color: #78350f;
    margin-bottom: 8px;
    font-size: 15px;
}
.instructions code {
    background-color: #fef3c7;
    padding: 2px 5px;
    border-radius: 4px;
    font-family: monospace;
}
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
        <li>Navigate to your selected folder</li>
        <li>Find the <code>${domain}</code> subfolder</li>
        <li>Edit the <code>index.html</code> file to customize your site</li>
        <li>Add more files as needed - they'll automatically appear on your site</li>
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

    if (isRegistering) return; // Prevent multiple clicks
    isRegistering = true;
    elements.registerButton.classList.add('loading');
    elements.registerButton.disabled = true;

    try {
        console.log('Starting registration for:', currentDomain);
        const targetPath = `${approvedParentPath}/${currentDomain}`;
        console.log('Creating directory at:', targetPath);
        /*
        * Creates a directory at the specified path.
        * The { dedupeName: true } option ensures that if the directory already exists,
        * it will not throw an error but will instead return the existing directory.
        */
        await puter.fs.mkdir(targetPath, { dedupeName: true });

        console.log('Generating landing page content');
        const htmlContent = generateLandingPageContent(currentDomain);
        console.log('Writing content to:', `${targetPath}/index.html`);
        // Write the landing page HTML content to the new directory using Puter filesystem API
        await puter.fs.write(`${targetPath}/index.html`, htmlContent);

        console.log('Registering subdomain:', currentDomain);
        // Register the subdomain with Puter hosting service, connecting it to the created directory
        const subdomain = await puter.hosting.create(currentDomain, targetPath);
        console.log('Subdomain registered:', subdomain);

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
        updateUI();
    }
}

function updateUI() {
    elements.registerButton.disabled = !approvedParentPath || !isAvailable || isRegistering;
}

elements.loginButton.addEventListener('click', handleLogin);
elements.logoutButton.addEventListener('click', handleLogout);
elements.folderButton.addEventListener('click', selectFolder);
elements.registerButton.addEventListener('click', () => {
    console.log('Register button clicked');
    registerSubdomain();
});

elements.subdomainInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(checkAvailability, 300);
});

updateAuthUI();