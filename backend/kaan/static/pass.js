function generatePassword(length) {
    // Define character sets
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const specialChars = '!@#$%^&*()-=_+[]{}|;:,.<>?';

    // Combine all character sets
    const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;

    let password = '';

    // Generate password
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * allChars.length);
        password += allChars.charAt(randomIndex);
    }

    return password;
}

const generatedPassword = generatePassword(24);
window.addEventListener("load", (event) => {
    document.getElementById('pass').value = generatedPassword;
});

function copy() {
    // Get the text field
    var copyText = document.getElementById("pass");

    // Select the text field
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices

    // Copy the text inside the text field
    navigator.clipboard.writeText(copyText.value);
}