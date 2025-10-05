/**
 * VIDAA TV Remote Command Handler
 * Erweitert die Function Explorer App um Remote-Steuerung
 *
 * Füge dieses Script in den TV Function Explorer ein:
 * 1. Öffne Function Explorer auf TV
 * 2. Kopiere diesen Code in die Console
 * 3. Das Script checkt automatisch nach Befehlen vom Laptop
 */

(function () {
  'use strict';

  console.log('🚀 VIDAA Remote Command Handler wird initialisiert...');

  // Configuration - Use local DNS
  const RECEIVER_URL = 'http://vidaahub.com:3000'; // Lokale DNS Domain
  let isRemoteEnabled = true;
  let commandCheckInterval = null;

  // Remote Command Checker
  function startRemoteCommandChecker() {
    if (commandCheckInterval) {
      clearInterval(commandCheckInterval);
    }

    console.log('📡 Remote Command Checker gestartet');

    commandCheckInterval = setInterval(async () => {
      if (!isRemoteEnabled) return;

      try {
        // Check for commands from laptop
        const response = await fetch(`${RECEIVER_URL}/api/command-check`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.log('⚠️ Receiver nicht erreichbar');
          return;
        }

        const data = await response.json();

        if (data.hasCommand) {
          console.log(`📥 Remote Command empfangen: ${data.command.function}`);
          await executeRemoteCommand(data.command);
        }
      } catch (error) {
        console.log(`❌ Command check error: ${error.message}`);
      }
    }, 2000); // Check every 2 seconds
  }

  // Execute command from laptop
  async function executeRemoteCommand(command) {
    console.log(
      `🔧 Führe aus: ${command.function}(${command.parameters.join(', ')})`
    );

    let result = {
      commandId: command.id,
      function: command.function,
      parameters: command.parameters,
      success: false,
      data: null,
      error: null,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get the function
      const func = window[command.function];
      if (typeof func !== 'function') {
        throw new Error(`Function ${command.function} not found`);
      }

      // Execute with parameters
      const output = func.apply(null, command.parameters);

      result.success = true;
      result.data = output;

      console.log(`✅ Erfolg: ${JSON.stringify(output)}`);
    } catch (error) {
      result.error = error.message;
      console.log(`❌ Fehler: ${error.message}`);
    }

    // Send result back to receiver
    try {
      await fetch(`${RECEIVER_URL}/api/execute-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });

      console.log('📤 Ergebnis an Receiver gesendet');
    } catch (error) {
      console.log(`❌ Failed to send result: ${error.message}`);
    }
  }

  // Remote Control UI
  function createRemoteControlUI() {
    // Check if UI already exists
    if (document.getElementById('remote-control-ui')) {
      return;
    }

    const ui = document.createElement('div');
    ui.id = 'remote-control-ui';
    ui.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            min-width: 250px;
            border: 2px solid rgba(255,255,255,0.2);
        `;

    ui.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>🎮 Remote Control</strong>
                <button id="toggle-remote" style="background: #ff4757; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                    ${isRemoteEnabled ? 'AUS' : 'EIN'}
                </button>
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                Status: <span id="remote-status">${
                  isRemoteEnabled ? '🟢 AKTIV' : '🔴 INAKTIV'
                }</span><br>
                Receiver: <span id="receiver-status">🔍 Prüfen...</span><br>
                Letzter Befehl: <span id="last-command">-</span>
            </div>
            <div style="margin-top: 10px; font-size: 11px; opacity: 0.7;">
                Server: ${RECEIVER_URL}
            </div>
        `;

    document.body.appendChild(ui);

    // Toggle button handler
    document.getElementById('toggle-remote').addEventListener('click', () => {
      isRemoteEnabled = !isRemoteEnabled;
      document.getElementById('toggle-remote').textContent = isRemoteEnabled
        ? 'AUS'
        : 'EIN';
      document.getElementById('remote-status').textContent = isRemoteEnabled
        ? '🟢 AKTIV'
        : '🔴 INAKTIV';

      if (isRemoteEnabled) {
        startRemoteCommandChecker();
      } else if (commandCheckInterval) {
        clearInterval(commandCheckInterval);
        commandCheckInterval = null;
      }
    });

    // Update receiver status
    setInterval(async () => {
      try {
        const response = await fetch(`${RECEIVER_URL}/api/status`, {
          method: 'GET',
        });
        if (response.ok) {
          document.getElementById('receiver-status').textContent =
            '🟢 VERBUNDEN';
        } else {
          document.getElementById('receiver-status').textContent = '🟡 SCHWACH';
        }
      } catch (error) {
        document.getElementById('receiver-status').textContent = '🔴 OFFLINE';
      }
    }, 5000);
  }

  // Initialize
  console.log('🎯 Initialisiere Remote Control System...');
  createRemoteControlUI();

  if (isRemoteEnabled) {
    startRemoteCommandChecker();
  }

  // Add to global scope for debugging
  window.remoteControl = {
    enable: () => {
      isRemoteEnabled = true;
      startRemoteCommandChecker();
      console.log('✅ Remote Control aktiviert');
    },
    disable: () => {
      isRemoteEnabled = false;
      if (commandCheckInterval) {
        clearInterval(commandCheckInterval);
        commandCheckInterval = null;
      }
      console.log('❌ Remote Control deaktiviert');
    },
    status: () => {
      return {
        enabled: isRemoteEnabled,
        receiverUrl: RECEIVER_URL,
        hasInterval: !!commandCheckInterval,
      };
    },
    executeTest: async (functionName = 'Hisense_GetApiVersion') => {
      console.log(`🧪 Test-Ausführung: ${functionName}`);
      const testCommand = {
        id: 'test-' + Date.now(),
        function: functionName,
        parameters: [],
        timestamp: new Date().toISOString(),
      };
      await executeRemoteCommand(testCommand);
    },
  };

  console.log('✅ VIDAA Remote Command Handler bereit!');
  console.log('💡 Verfügbare Befehle:');
  console.log('   window.remoteControl.enable()   - Remote Control aktivieren');
  console.log(
    '   window.remoteControl.disable()  - Remote Control deaktivieren'
  );
  console.log('   window.remoteControl.status()   - Status anzeigen');
  console.log(
    '   window.remoteControl.executeTest() - Test-Funktion ausführen'
  );
})();

/**
 * QUICK SETUP ANLEITUNG:
 *
 * 1. Laptop: Starte enhanced-receiver.js
 *    > node enhanced-receiver.js
 *
 * 2. Öffne Remote Console im Browser:
 *    > http://localhost:3001 -> remote-console.html
 *
 * 3. TV: Öffne Function Explorer
 *
 * 4. TV: Kopiere dieses komplette Script in die Browser Console
 *
 * 5. WICHTIG: Stelle sicher, dass vidaahub.com auf beiden Geräten zur Laptop-IP zeigt!
 *
 * 6. Das Remote Control UI erscheint oben rechts auf dem TV
 *
 * 7. Jetzt kannst du vom Laptop aus TV-Funktionen ausführen!
 *
 * TROUBLESHOOTING:
 * - Firewall auf Laptop prüfen (Ports 3000, 3001)
 * - DNS: vidaahub.com zeigt auf Laptop-IP? (ping vidaahub.com)
 * - TV und Laptop im gleichen Netzwerk?
 * - Browser Console auf TV für Fehlermeldungen prüfen
 */
