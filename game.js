class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;

        // Initialize Web Audio API
        this.audioContext = null; // Will be initialized after user interaction

        // Sound system
        this.sounds = {
            shoot: new Audio('sounds/shoot.wav'),
            laser: new Audio('sounds/laser.wav'),
            explosion: new Audio('sounds/explosion.wav'),
            hit: new Audio('sounds/hit.wav'),
            powerUp: new Audio('sounds/power_up.wav'),
            gameOver: new Audio('sounds/game_over.wav'),
            shieldRecharge: new Audio('sounds/shield_recharge.wav'),
            enemyDeath: new Audio('sounds/enemy_death.wav'),
            ufoShoot: new Audio('sounds/ufo_shoot.wav'),
            ufoHit: new Audio('sounds/ufo_hit.wav'),
            ufoDeath: new Audio('sounds/ufo_death.wav'),
            ufoPresence: new Audio('sounds/ufo_presence.wav'),
            charge: new Audio('sounds/charge.wav'),
            blob: new Audio('sounds/blob.wav')
        };

        // Set volume for all sounds
        for (const sound of Object.values(this.sounds)) {
            sound.volume = 0.3; // 30% volume
        }

        // Preload all sounds
        this.preloadSounds().then(() => {
            // Start game after sounds are loaded
            this.initializeGame();
        });
    }

    async preloadSounds() {
        const soundPromises = Object.values(this.sounds).map(sound => {
            return new Promise((resolve, reject) => {
                sound.addEventListener('canplaythrough', () => {
                    resolve();
                }, { once: true });
                sound.addEventListener('error', (e) => {
                    reject(e);
                }, { once: true });
                // Start loading
                sound.load();
            });
        });

        try {
            await Promise.all(soundPromises);
            console.log('All sounds loaded successfully');
        } catch (error) {
            console.error('Error loading sounds:', error);
        }
    }

    initializeGame() {
        // Game state
        this.gameOver = false;
        this.isGameOverSequence = false;
        this.score = 0;
        this.gravity = 0.1;
        this.jumpForce = -4;
        this.shields = 3;
        this.isInvulnerable = false;
        this.invulnerabilityTime = 1000;
        this.lastHitTime = 0;
        this.explosionParticles = [];
        this.explosionTimer = 0;
        this.explosionDuration = 1000;
        this.scrollSpeed = 2;

        // Star field
        this.stars = {
            far: this.createStarLayer(150, 0.2, 1),
            medium: this.createStarLayer(80, 0.4, 2),
            close: this.createStarLayer(20, 0.8, 3)
        };

        // Player
        this.player = {
            x: 100,
            y: this.canvas.height / 2,
            width: 40,
            height: 40,
            velocity: 0,
            bullets: [],
            lastShot: 0,
            shootCooldown: 400,
            isShooting: false,
            isCharging: false,
            chargeLevel: 0,
            maxCharge: 100,
            chargeRate: 1,
            lastChargeSound: 0,
            chargeSoundInterval: 100,
            weapon: {
                type: 'default',
                ammo: 0,
                cooldown: 400
            }
        };

        // Enemies
        this.enemies = [];
        this.enemyTimer = 0;
        this.enemyInterval = 2000;
        this.enemyBullets = [];
        this.lastEnemyShot = 0;
        this.enemyShootCooldown = 2000;

        // Power-ups
        this.powerUps = [];
        this.powerUpTimer = 0;
        this.powerUpInterval = 2000;
        this.powerUpDropChance = 0.6;

        // Obstacles
        this.obstacles = [];
        this.obstacleTimer = 0;
        this.obstacleInterval = 1500;

        // UFO specific
        this.hasUFO = false;
        this.ufoSpawnChance = 0.1;
        this.ufoShootCooldown = 1000;
        this.lastUFOShot = 0;

        // Tentacle Blob specific
        this.hasBlob = false;
        this.blobSpawnChance = 0.05; // Reduced from 0.3 to 0.05 (5% chance)
        this.blobShootCooldown = 1500;
        this.lastBlobShot = 0;
        this.blobTentacleAngle = 0;

        // UI elements
        this.gameOverElement = document.getElementById('gameOver');
        this.finalScoreElement = document.getElementById('finalScore');
        this.restartButton = document.getElementById('restartButton');

        // Event listeners
        this.setupEventListeners();

        // Start game loop
        this.lastTime = 0;
        this.animate(0);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.gameOver) {
                this.initializeAudioContext(); // Initialize audio on first interaction
                this.jump();
            }
            if (e.code === 'KeyX' && !this.gameOver) {
                this.initializeAudioContext(); // Initialize audio on first interaction
                if (this.player.weapon.type === 'chargeGun') {
                    this.player.isCharging = true;
                } else {
                    this.player.isShooting = true;
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyX') {
                if (this.player.weapon.type === 'chargeGun' && this.player.isCharging) {
                    this.releaseChargeShot();
                }
                this.player.isShooting = false;
                this.player.isCharging = false;
            }
        });

        this.canvas.addEventListener('click', () => {
            if (!this.gameOver) {
                this.initializeAudioContext(); // Initialize audio on first interaction
                this.jump();
            }
        });

        this.restartButton.addEventListener('click', () => {
            this.initializeAudioContext(); // Initialize audio on restart
            this.restart();
        });
    }

    jump() {
        this.player.velocity = this.jumpForce;
    }

    shoot() {
        const currentTime = performance.now();
        if (currentTime - this.player.lastShot >= this.player.weapon.cooldown) {
            if (this.player.weapon.type === 'fastLaser') {
                if (this.player.weapon.ammo > 0) {
                    this.player.bullets.push({
                        x: this.player.x + this.player.width,
                        y: this.player.y + this.player.height / 2,
                        width: 10,
                        height: 6,
                        speed: 30,
                        type: 'laser'
                    });
                    this.player.weapon.ammo--;
                    this.player.lastShot = currentTime;
                    this.sounds.laser.currentTime = 0;
                    this.sounds.laser.play();
                } else {
                    // Switch back to default weapon when out of ammo
                    this.player.weapon = {
                        type: 'default',
                        ammo: 0,
                        cooldown: 400
                    };
                }
            } else {
                // Default weapon
                this.player.bullets.push({
                    x: this.player.x + this.player.width,
                    y: this.player.y + this.player.height / 2,
                    width: 10,
                    height: 5,
                    speed: 10,
                    type: 'default'
                });
                this.player.lastShot = currentTime;
                this.sounds.shoot.currentTime = 0;
                this.sounds.shoot.play();
            }
        }
    }

    createEnemy() {
        const isMoving = Math.random() < 0.5;
        const isUFO = !this.hasUFO && Math.random() < this.ufoSpawnChance;
        const isBlob = !this.hasBlob && Math.random() < this.blobSpawnChance;

        if (isUFO) {
            this.hasUFO = true;
            this.sounds.ufoPresence.currentTime = 0;
            this.sounds.ufoPresence.play();
        }

        if (isBlob) {
            this.hasBlob = true;
            this.sounds.blob.currentTime = 0;
            this.sounds.blob.play();
        }

        this.enemies.push({
            x: this.canvas.width,
            y: Math.random() * (this.canvas.height - 40),
            width: 40,
            height: 40,
            isMoving: isMoving,
            isUFO: isUFO,
            isBlob: isBlob,
            health: isUFO ? 5 : (isBlob ? 8 : 1),
            moveTimer: 0,
            moveInterval: 500,
            moveDirection: {
                x: Math.random() * 2 - 1,
                y: Math.random() * 2 - 1
            },
            speed: 2,
            tentacleAngle: 0,
            // Add blob-specific properties
            isReturning: false,
            leftSideTimer: 0,
            leftSideDuration: 3000, // 3 seconds on left side
            returnSpeed: 8, // Speed when returning to right side
            rightSideTimer: 0,
            rightSideDuration: 5000, // Reduced from 12000 to 5000 (5 seconds on right side)
            isMovingToLeft: false
        });
    }

    createPowerUp(x, y) {
        const types = ['shield', 'fastLaser', 'chargeGun'];
        const weights = [0.3, 0.3, 0.4];
        const random = Math.random();
        let cumulativeWeight = 0;
        let selectedType = types[0];

        for (let i = 0; i < types.length; i++) {
            cumulativeWeight += weights[i];
            if (random < cumulativeWeight) {
                selectedType = types[i];
                break;
            }
        }

        this.powerUps.push({
            x: x,
            y: y,
            width: 30,
            height: 30,
            speed: 2,
            type: selectedType,
            pulseTimer: 0
        });
    }

    updateEnemies(deltaTime) {
        this.enemyTimer += deltaTime;
        if (this.enemyTimer > this.enemyInterval) {
            this.createEnemy();
            this.enemyTimer = 0;
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            if (enemy.isUFO) {
                // UFO movement
                enemy.moveTimer += deltaTime;
                if (enemy.moveTimer > enemy.moveInterval) {
                    enemy.moveDirection.x = Math.random() * 2 - 1;
                    enemy.moveDirection.y = Math.random() * 2 - 1;
                    enemy.moveTimer = 0;
                }

                // Update position
                enemy.x += enemy.moveDirection.x * enemy.speed;
                enemy.y += enemy.moveDirection.y * enemy.speed;

                // Keep UFO on screen
                if (enemy.x < 0) enemy.x = 0;
                if (enemy.x + enemy.width > this.canvas.width) enemy.x = this.canvas.width - enemy.width;
                if (enemy.y < 0) enemy.y = 0;
                if (enemy.y + enemy.height > this.canvas.height) enemy.y = this.canvas.height - enemy.height;

                // UFO shooting
                const currentTime = performance.now();
                if (currentTime - this.lastUFOShot >= this.ufoShootCooldown) {
                    // Calculate direction to player
                    const dx = this.player.x - enemy.x;
                    const dy = this.player.y - enemy.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const normalizedDx = dx / distance;
                    const normalizedDy = dy / distance;

                    this.enemyBullets.push({
                        x: enemy.x,
                        y: enemy.y + enemy.height / 2,
                        width: 8,
                        height: 8,
                        speed: 10,
                        type: 'ufo',
                        dx: normalizedDx,
                        dy: normalizedDy
                    });

                    // Generate UFO shot sound
                    this.generateUFOShotSound();

                    this.lastUFOShot = currentTime;
                }
            } else if (enemy.isBlob) {
                // Blob movement
                enemy.moveTimer += deltaTime;

                if (enemy.isReturning) {
                    // Move quickly to the right
                    enemy.x += enemy.returnSpeed;
                    if (enemy.x > this.canvas.width - enemy.width) {
                        enemy.x = this.canvas.width - enemy.width;
                        enemy.isReturning = false;
                        enemy.leftSideTimer = 0;
                        enemy.rightSideTimer = 0;
                        enemy.isMovingToLeft = false;
                    }
                } else if (enemy.isMovingToLeft) {
                    // Normal movement when on left side
                    if (enemy.moveTimer > enemy.moveInterval) {
                        // Calculate direction to player
                        const dx = this.player.x - enemy.x;
                        const dy = this.player.y - enemy.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Mix player pursuit with random movement
                        const pursuitWeight = 0.7;
                        enemy.moveDirection.x = (dx / distance) * pursuitWeight + (Math.random() * 2 - 1) * (1 - pursuitWeight);
                        enemy.moveDirection.y = (dy / distance) * pursuitWeight + (Math.random() * 2 - 1) * (1 - pursuitWeight);

                        // Normalize the direction
                        const newDistance = Math.sqrt(enemy.moveDirection.x * enemy.moveDirection.x + enemy.moveDirection.y * enemy.moveDirection.y);
                        enemy.moveDirection.x /= newDistance;
                        enemy.moveDirection.y /= newDistance;

                        enemy.moveTimer = 0;
                    }

                    // Update position
                    enemy.x += enemy.moveDirection.x * enemy.speed * 1.5;
                    enemy.y += enemy.moveDirection.y * enemy.speed * 1.5;

                    // Keep blob on screen
                    if (enemy.x < 0) enemy.x = 0;
                    if (enemy.x + enemy.width > this.canvas.width) enemy.x = this.canvas.width - enemy.width;
                    if (enemy.y < 0) enemy.y = 0;
                    if (enemy.y + enemy.height > this.canvas.height) enemy.y = this.canvas.height - enemy.height;

                    // Update left side timer
                    enemy.leftSideTimer += deltaTime;
                    if (enemy.leftSideTimer >= enemy.leftSideDuration) {
                        enemy.isReturning = true;
                    }
                } else {
                    // Stay on right side
                    enemy.rightSideTimer += deltaTime;
                    if (enemy.rightSideTimer >= enemy.rightSideDuration) {
                        enemy.isMovingToLeft = true;
                        enemy.rightSideTimer = 0;
                    }

                    // Move around on right side
                    if (enemy.moveTimer > enemy.moveInterval) {
                        // Random movement within right side area
                        const rightSideArea = this.canvas.width * 0.3; // 30% of screen width
                        const targetX = this.canvas.width - rightSideArea + Math.random() * rightSideArea;
                        const targetY = Math.random() * (this.canvas.height - enemy.height);

                        const dx = targetX - enemy.x;
                        const dy = targetY - enemy.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance > 0) {
                            enemy.moveDirection.x = dx / distance;
                            enemy.moveDirection.y = dy / distance;
                        }

                        enemy.moveTimer = 0;
                    }

                    // Update position
                    enemy.x += enemy.moveDirection.x * enemy.speed;
                    enemy.y += enemy.moveDirection.y * enemy.speed;

                    // Keep blob within right side area
                    const rightSideArea = this.canvas.width * 0.3;
                    if (enemy.x < this.canvas.width - rightSideArea) enemy.x = this.canvas.width - rightSideArea;
                    if (enemy.x + enemy.width > this.canvas.width) enemy.x = this.canvas.width - enemy.width;
                    if (enemy.y < 0) enemy.y = 0;
                    if (enemy.y + enemy.height > this.canvas.height) enemy.y = this.canvas.height - enemy.height;
                }

                // Update tentacle animation
                enemy.tentacleAngle += 0.001;
                if (!enemy.tentacleLength) enemy.tentacleLength = 20;
                if (!enemy.tentaclePhase) enemy.tentaclePhase = 0;

                // Update tentacle phase for extension/retraction
                enemy.tentaclePhase += 0.005;
                if (enemy.tentaclePhase > Math.PI * 2) enemy.tentaclePhase = 0;

                // Update tentacle wiggle phase
                if (!enemy.wigglePhase) enemy.wigglePhase = 0;
                enemy.wigglePhase += 0.01;

                // Blob shooting
                const currentTime = performance.now();
                if (currentTime - this.lastBlobShot >= this.blobShootCooldown) {
                    // Shoot in 8 directions
                    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                        const dx = Math.cos(angle);
                        const dy = Math.sin(angle);

                        this.enemyBullets.push({
                            x: enemy.x + enemy.width / 2,
                            y: enemy.y + enemy.height / 2,
                            width: 15, // Increased from 10 to 15
                            height: 15, // Increased from 10 to 15
                            speed: 8,
                            type: 'blob',
                            dx: dx,
                            dy: dy
                        });
                    }

                    // Generate blob shot sound
                    this.generateBlobShotSound();

                    this.lastBlobShot = currentTime;
                }

                // Check collision with player
                if (this.checkTentacleCollision(this.player, enemy)) {
                    this.handleHit();
                    continue;
                }
            } else if (enemy.isMoving) {
                enemy.x -= 3;
            } else {
                enemy.x -= this.scrollSpeed;
            }

            // Check collision with player (only for non-blob enemies)
            if (!enemy.isBlob && this.player.x + this.player.width > enemy.x &&
                this.player.x < enemy.x + enemy.width &&
                this.player.y + this.player.height > enemy.y &&
                this.player.y < enemy.y + enemy.height) {

                this.handleHit();
                this.enemies.splice(i, 1);
                continue;
            }

            // Remove enemies that are off screen (only for non-UFO and non-blob enemies)
            if (!enemy.isUFO && !enemy.isBlob && enemy.x + enemy.width < 0) {
                this.enemies.splice(i, 1);
            }
        }

        // Handle regular enemy shooting
        const currentTime = performance.now();
        if (currentTime - this.lastEnemyShot >= this.enemyShootCooldown) {
            for (const enemy of this.enemies) {
                if (!enemy.isUFO && !enemy.isBlob) {
                    this.enemyBullets.push({
                        x: enemy.x,
                        y: enemy.y + enemy.height / 2,
                        width: 10,
                        height: 5,
                        speed: 5,
                        type: 'normal'
                    });

                    // Generate enemy shot sound
                    this.generateEnemyShotSound();
                }
            }
            this.lastEnemyShot = currentTime;
        }
    }

    updatePowerUps(deltaTime) {
        this.powerUpTimer += deltaTime;
        if (this.powerUpTimer > this.powerUpInterval) {
            if (Math.random() < this.powerUpDropChance) {
                this.createPowerUp(
                    this.canvas.width,
                    Math.random() * (this.canvas.height - 30)
                );
            }
            this.powerUpTimer = 0;
        }

        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            powerUp.x -= this.scrollSpeed;
            powerUp.pulseTimer += deltaTime;

            // Check collision with player
            if (this.player.x + this.player.width > powerUp.x &&
                this.player.x < powerUp.x + powerUp.width &&
                this.player.y + this.player.height > powerUp.y &&
                this.player.y < powerUp.y + powerUp.height) {

                if (powerUp.type === 'shield') {
                    // Always play shield sound and give temporary invulnerability
                    this.sounds.shieldRecharge.currentTime = 0;
                    this.sounds.shieldRecharge.play();
                    this.isInvulnerable = true;
                    this.lastHitTime = performance.now();

                    // Only increase shields if not at max
                    if (this.shields < 3) {
                        this.shields++;
                    }
                } else if (powerUp.type === 'fastLaser') {
                    // Add 50 ammo to current amount if already using laser
                    if (this.player.weapon.type === 'fastLaser') {
                        this.player.weapon.ammo += 50;
                    } else {
                        // Switch to laser with 50 ammo if not using it
                        this.player.weapon = {
                            type: 'fastLaser',
                            ammo: 50,
                            cooldown: 50
                        };
                    }
                    this.sounds.powerUp.currentTime = 0;
                    this.sounds.powerUp.play();
                } else if (powerUp.type === 'chargeGun') {
                    this.player.weapon = {
                        type: 'chargeGun',
                        ammo: 50, // Start with 50 ammo
                        cooldown: 400
                    };
                    this.sounds.powerUp.currentTime = 0;
                    this.sounds.powerUp.play();
                }

                this.powerUps.splice(i, 1);
                continue;
            }

            // Remove power-ups that are off screen
            if (powerUp.x + powerUp.width < 0) {
                this.powerUps.splice(i, 1);
            }
        }
    }

    updateBullets() {
        // Update player bullets
        for (let i = this.player.bullets.length - 1; i >= 0; i--) {
            const bullet = this.player.bullets[i];

            if (bullet.type === 'charge') {
                bullet.x += bullet.dx;
                bullet.y += bullet.dy;
            } else {
                bullet.x += bullet.speed;
            }

            // Check collision with enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                if (this.checkBulletEnemyCollision(bullet, enemy)) {
                    this.player.bullets.splice(i, 1);
                    enemy.health--;
                    if (enemy.health <= 0) {
                        if (enemy.isUFO) {
                            this.hasUFO = false;
                            this.sounds.ufoDeath.currentTime = 0;
                            this.sounds.ufoDeath.play();
                            // Create grey explosion for UFO
                            this.createExplosion(
                                enemy.x + enemy.width / 2,
                                enemy.y + enemy.height / 2,
                                true
                            );
                            this.explosionTimer = 0; // Reset explosion timer
                        } else if (enemy.isBlob) {
                            this.hasBlob = false;
                            this.sounds.enemyDeath.currentTime = 0;
                            this.sounds.enemyDeath.play();
                            this.sounds.explosion.currentTime = 0;
                            this.sounds.explosion.play();
                            // Create purple explosion for blob
                            this.createExplosion(
                                enemy.x + enemy.width / 2,
                                enemy.y + enemy.height / 2,
                                false
                            );
                            this.explosionTimer = 0; // Reset explosion timer
                        } else {
                            this.sounds.enemyDeath.currentTime = 0;
                            this.sounds.enemyDeath.play();
                        }
                        this.enemies.splice(j, 1);
                        this.score += enemy.isUFO ? 50 : (enemy.isBlob ? 75 : 10);
                    } else if (enemy.isUFO) {
                        this.sounds.ufoHit.currentTime = 0;
                        this.sounds.ufoHit.play();
                    } else if (enemy.isBlob) {
                        this.sounds.hit.currentTime = 0;
                        this.sounds.hit.play();
                    }
                    break;
                }
            }

            // Remove bullets that are off screen
            if (bullet.x > this.canvas.width || bullet.x < 0 ||
                bullet.y > this.canvas.height || bullet.y < 0) {
                this.player.bullets.splice(i, 1);
            }
        }

        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];

            if (bullet.type === 'ufo') {
                // UFO bullets move towards player
                bullet.x += bullet.dx * bullet.speed;
                bullet.y += bullet.dy * bullet.speed;
            } else if (bullet.type === 'blob') {
                // Blob bullets move in their direction
                bullet.x += bullet.dx * bullet.speed;
                bullet.y += bullet.dy * bullet.speed;
            } else {
                // Regular bullets move left
                bullet.x -= bullet.speed;
            }

            // Check collision with player
            if (this.player.x + this.player.width > bullet.x &&
                this.player.x < bullet.x + bullet.width &&
                this.player.y + this.player.height > bullet.y &&
                this.player.y < bullet.y + bullet.height) {

                this.handleHit();
                this.enemyBullets.splice(i, 1);
                continue;
            }

            // Remove bullets that are off screen
            if (bullet.x + bullet.width < 0 ||
                bullet.x > this.canvas.width ||
                bullet.y + bullet.height < 0 ||
                bullet.y > this.canvas.height) {
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    checkBulletEnemyCollision(bullet, enemy) {
        return bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y;
    }

    // Add new method to check tentacle collision
    checkTentacleCollision(player, enemy) {
        if (!enemy.isBlob) return false;

        const tentacleCount = 8;
        const baseLength = 120;
        const tentacleWidth = 5;

        for (let i = 0; i < tentacleCount; i++) {
            const baseAngle = (Math.PI * 2 * i) / tentacleCount + enemy.tentacleAngle;
            const extension = Math.sin(enemy.tentaclePhase + i * 0.5) * 0.5 + 0.5;
            const length = baseLength * (0.7 + extension * 0.3);

            const wiggle = Math.sin(enemy.wigglePhase + i * 0.8) * 15;
            const angle = baseAngle + wiggle * 0.1;

            // Start tentacle from the edge of the blob instead of center
            const blobRadius = enemy.width / 2;
            const startX = enemy.x + enemy.width / 2 + Math.cos(angle) * blobRadius;
            const startY = enemy.y + enemy.height / 2 + Math.sin(angle) * blobRadius;

            // Calculate control points for the curve
            const midLength = length * 0.5;
            const controlAngle1 = angle + Math.sin(enemy.wigglePhase + i * 0.8) * 0.3;
            const controlAngle2 = angle + Math.sin(enemy.wigglePhase + i * 0.8 + 0.5) * 0.3;

            const controlX1 = startX + Math.cos(controlAngle1) * midLength;
            const controlY1 = startY + Math.sin(controlAngle1) * midLength;
            const controlX2 = startX + Math.cos(controlAngle2) * midLength * 1.5;
            const controlY2 = startY + Math.sin(controlAngle2) * midLength * 1.5;

            const endX = startX + Math.cos(angle) * length;
            const endY = startY + Math.sin(angle) * length;

            // Use different shades of purple for each tentacle
            const hue = 270 + (i * 5); // Smaller hue variation to stay in purple range
            const saturation = 85 + (i % 2 * 15); // Slightly higher base saturation
            const lightness = 35 + (i % 3 * 15); // More contrast in lightness
            const tentacleColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

            // Draw tentacle
            this.ctx.strokeStyle = tentacleColor;
            this.ctx.lineWidth = tentacleWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
            this.ctx.stroke();

            // Draw tentacle tip with slightly darker shade
            this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`;
            this.ctx.beginPath();
            this.ctx.arc(endX, endY, tentacleWidth / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Check collision with blob body
        const dx = player.x + player.width / 2 - (enemy.x + enemy.width / 2);
        const dy = player.y + player.height / 2 - (enemy.y + enemy.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (player.width / 2 + enemy.width / 2);
    }

    handleHit() {
        // Always play hit sound on collision, regardless of invulnerability
        try {
            const hitSound = new Audio('sounds/hit.wav');
            hitSound.volume = 0.3;
            hitSound.play().catch(e => console.log('Error playing hit sound:', e));
        } catch (e) {
            console.log('Error creating hit sound:', e);
        }

        // Then check for invulnerability
        if (this.isInvulnerable) return;

        const currentTime = performance.now();
        if (currentTime - this.lastHitTime < this.invulnerabilityTime) return;

        if (this.shields > 0) {
            this.shields--;
        } else {
            // If shields are 0, this is the final hit
            this.gameOver = true;
            this.isGameOverSequence = true;
            this.explosionTimer = 0;
            this.createExplosion(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2
            );
            this.sounds.explosion.currentTime = 0;
            this.sounds.explosion.play();
            this.sounds.gameOver.currentTime = 0;
            this.sounds.gameOver.play();
            this.gameOverElement.classList.remove('hidden');
            this.finalScoreElement.textContent = this.score;
            return;
        }

        this.lastHitTime = currentTime;
        this.isInvulnerable = true;
    }

    createObstacle() {
        const gap = 250;
        const minHeight = 50;
        const maxHeight = this.canvas.height - gap - minHeight;
        const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;

        // Generate random grey shade for the skyscraper
        const greyShade = Math.floor(Math.random() * 40) + 20; // Random shade between 20 and 60
        const baseColor = `rgb(${greyShade}, ${greyShade}, ${greyShade})`;

        this.obstacles.push({
            x: this.canvas.width,
            topHeight: topHeight,
            bottomY: topHeight + gap,
            width: 50,
            passed: false,
            baseColor: baseColor,
            windowPattern: this.generateWindowPattern()
        });
    }

    generateWindowPattern() {
        const pattern = [];
        const rows = 20; // Number of window rows
        const cols = 3;  // Number of window columns

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // 70% chance for a window to be present
                if (Math.random() < 0.7) {
                    // 30% chance for a lit window
                    const isLit = Math.random() < 0.3;
                    pattern.push({
                        row: row,
                        col: col,
                        isLit: isLit
                    });
                }
            }
        }
        return pattern;
    }

    drawObstacles() {
        for (const obstacle of this.obstacles) {
            // Draw top skyscraper
            this.drawSkyscraper(
                obstacle.x,
                0,
                obstacle.width,
                obstacle.topHeight,
                obstacle.baseColor,
                obstacle.windowPattern
            );

            // Draw bottom skyscraper
            this.drawSkyscraper(
                obstacle.x,
                obstacle.bottomY,
                obstacle.width,
                this.canvas.height - obstacle.bottomY,
                obstacle.baseColor,
                obstacle.windowPattern
            );
        }
    }

    drawSkyscraper(x, y, width, height, baseColor, windowPattern) {
        // Draw skyscraper base
        this.ctx.fillStyle = baseColor;
        this.ctx.fillRect(x, y, width, height);

        // Draw windows
        const windowWidth = 8;
        const windowHeight = 12;
        const windowSpacing = 4;
        const startX = x + (width - (windowWidth * 3 + windowSpacing * 2)) / 2;
        const startY = y + 10;

        for (const window of windowPattern) {
            const windowX = startX + window.col * (windowWidth + windowSpacing);
            const windowY = startY + window.row * (windowHeight + windowSpacing);

            // Only draw windows that fit within the skyscraper height
            if (windowY + windowHeight <= y + height) {
                this.ctx.fillStyle = window.isLit ? '#ffff00' : '#000000';
                this.ctx.fillRect(windowX, windowY, windowWidth, windowHeight);
            }
        }
    }

    updateObstacles(deltaTime) {
        this.obstacleTimer += deltaTime;

        if (this.obstacleTimer > this.obstacleInterval) {
            this.createObstacle();
            this.obstacleTimer = 0;
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.x -= this.scrollSpeed;

            if (!obstacle.passed && obstacle.x + obstacle.width < this.player.x) {
                obstacle.passed = true;
                this.score++;
            }

            if (obstacle.x + obstacle.width < 0) {
                this.obstacles.splice(i, 1);
            }
        }
    }

    checkCollision() {
        if (this.isInvulnerable) return;

        for (const obstacle of this.obstacles) {
            if (this.player.x + this.player.width > obstacle.x &&
                this.player.x < obstacle.x + obstacle.width &&
                this.player.y < obstacle.topHeight) {
                this.handleHit();
                this.lastHitTime = performance.now();
                this.isInvulnerable = true;
                return;
            }

            if (this.player.x + this.player.width > obstacle.x &&
                this.player.x < obstacle.x + obstacle.width &&
                this.player.y + this.player.height > obstacle.bottomY) {
                this.handleHit();
                this.lastHitTime = performance.now();
                this.isInvulnerable = true;
                return;
            }
        }

        if (this.player.y < 0) {
            this.handleHit();
            this.lastHitTime = performance.now();
            this.isInvulnerable = true;
        }
    }

    createExplosion(x, y, isUFO = false) {
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 3 + Math.random() * 3;
            this.explosionParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 4 + Math.random() * 4,
                alpha: 1,
                color: isUFO ?
                    `hsl(0, 0%, ${Math.random() * 30 + 50}%)` : // Grey shades (50-80%) for UFO
                    `hsl(${Math.random() * 40 + 270}, 100%, 50%)`   // Purple shades (270-310) for blob
            });
        }
    }

    updateExplosion(deltaTime) {
        this.explosionTimer += deltaTime;

        for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
            const particle = this.explosionParticles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // Add gravity to particles
            particle.alpha = 1 - (this.explosionTimer / this.explosionDuration);

            if (particle.alpha <= 0) {
                this.explosionParticles.splice(i, 1);
            }
        }
    }

    createStarLayer(count, brightness, size) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: size,
                brightness: brightness
            });
        }
        return stars;
    }

    updateStars() {
        // Update each layer of stars
        for (const layer of Object.values(this.stars)) {
            for (const star of layer) {
                star.x -= this.scrollSpeed * star.brightness;
                if (star.x < -star.size) {
                    star.x = this.canvas.width + star.size;
                    star.y = Math.random() * this.canvas.height;
                }
            }
        }
    }

    drawStars() {
        // Draw each layer of stars
        for (const layer of Object.values(this.stars)) {
            for (const star of layer) {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    update(deltaTime) {
        if (this.gameOver) {
            if (this.isGameOverSequence) {
                this.updateExplosion(deltaTime);
                this.scrollSpeed = Math.max(0, this.scrollSpeed - 0.01);
            }
            return;
        }

        const currentTime = performance.now();
        if (this.isInvulnerable && currentTime - this.lastHitTime >= this.invulnerabilityTime) {
            this.isInvulnerable = false;
        }

        // Update shield blink effect
        if (this.isInvulnerable) {
            this.shieldBlinkTimer = (this.shieldBlinkTimer || 0) + deltaTime;
            this.shieldBlinkPhase = Math.sin(this.shieldBlinkTimer / 25) * 0.5 + 0.5; // Much faster blink (25ms per cycle)
        } else {
            this.shieldBlinkTimer = 0;
            this.shieldBlinkPhase = 0;
        }

        // Update star field
        this.updateStars();

        // Handle continuous shooting
        if (this.player.isShooting) {
            this.shoot();
        }

        // Handle charging
        if (this.player.isCharging && this.player.weapon.type === 'chargeGun') {
            this.player.chargeLevel = Math.min(this.player.maxCharge, this.player.chargeLevel + this.player.chargeRate);

            // Play charge sound at intervals
            if (currentTime - this.player.lastChargeSound >= this.player.chargeSoundInterval) {
                const chargeSound = new Audio('sounds/charge.wav');
                chargeSound.volume = 0.3;
                chargeSound.play().catch(e => console.log('Error playing charge sound:', e));
                this.player.lastChargeSound = currentTime;
            }
        }

        this.player.velocity += this.gravity;
        this.player.y += this.player.velocity;

        if (this.player.y + this.player.height > this.canvas.height) {
            this.player.y = this.canvas.height - this.player.height;
            this.player.velocity = 0;
        }

        this.updateObstacles(deltaTime);
        this.updateEnemies(deltaTime);
        this.updatePowerUps(deltaTime);
        this.updateBullets();
        this.checkCollision();

        // Always update explosion particles
        this.updateExplosion(deltaTime);
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw star field
        this.drawStars();

        // Draw explosion particles first (so they appear behind other elements)
        for (const particle of this.explosionParticles) {
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.beginPath();
            this.ctx.arc(
                particle.x,
                particle.y,
                particle.size,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1; // Reset alpha

        // Draw score
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Score: ${this.score}`, this.canvas.width - 20, 30);

        // Draw ammo count if using fast laser or charge gun
        if (this.player.weapon.type === 'fastLaser' || this.player.weapon.type === 'chargeGun') {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'left';
            const ammoText = this.player.weapon.type === 'fastLaser' ? 'Laser Ammo: ' : 'Charge Ammo: ';
            this.ctx.fillText(ammoText + this.player.weapon.ammo, 20, 30);
        }

        // Draw player (frog) if not game over
        if (!this.gameOver) {
            // Draw blob body
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.beginPath();
            this.ctx.arc(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                this.player.width / 2,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Draw tiny frog legs
            this.ctx.fillStyle = '#3d8b40'; // Slightly darker green for legs
            // Left leg
            this.ctx.beginPath();
            this.ctx.ellipse(
                this.player.x + 10,
                this.player.y + this.player.height - 5,
                8,
                4,
                0,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Right leg
            this.ctx.beginPath();
            this.ctx.ellipse(
                this.player.x + this.player.width - 10,
                this.player.y + this.player.height - 5,
                8,
                4,
                0,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Draw eyes
            // First eye
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(
                this.player.x + this.player.width - 10,
                this.player.y + 10,
                5,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // First pupil
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(
                this.player.x + this.player.width - 8,
                this.player.y + 10,
                2,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Second eye
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(
                this.player.x + this.player.width - 25,
                this.player.y + 10,
                5,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Second pupil
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(
                this.player.x + this.player.width - 23,
                this.player.y + 10,
                2,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Draw mouth
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            if (this.player.isShooting) {
                // Round open mouth when shooting
                this.ctx.beginPath();
                this.ctx.arc(
                    this.player.x + this.player.width - 15,
                    this.player.y + 20,
                    8,
                    0,
                    Math.PI * 2
                );
                this.ctx.stroke();
                // Fill the mouth with black
                this.ctx.fillStyle = '#000000';
                this.ctx.fill();
            } else {
                // Normal smile
                this.ctx.beginPath();
                this.ctx.arc(
                    this.player.x + this.player.width - 15,
                    this.player.y + 20,
                    8,
                    0,
                    Math.PI
                );
                this.ctx.stroke();
            }

            // Draw shield indicators
            const shieldSize = 10;
            const shieldSpacing = 5;
            const shieldY = this.player.y - shieldSize - 5;
            const totalWidth = (shieldSize * 3) + (shieldSpacing * 2);
            const startX = this.player.x + (this.player.width - totalWidth) / 2;

            for (let i = 0; i < 3; i++) {
                this.ctx.fillStyle = i < this.shields ? '#00ffff' : '#333333';
                this.ctx.fillRect(
                    startX + (i * (shieldSize + shieldSpacing)),
                    shieldY,
                    shieldSize,
                    shieldSize
                );
            }

            if (this.isInvulnerable) {
                this.ctx.strokeStyle = `rgba(0, 255, 255, ${this.shieldBlinkPhase})`;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(
                    this.player.x + this.player.width / 2,
                    this.player.y + this.player.height / 2,
                    this.player.width * 0.8,
                    0,
                    Math.PI * 2
                );
                this.ctx.stroke();
            }
        }

        // Draw power-ups
        for (const powerUp of this.powerUps) {
            // Calculate pulse effect
            const pulseScale = 1 + Math.sin(powerUp.pulseTimer / 200) * 0.2;
            const pulseAlpha = 0.5 + Math.sin(powerUp.pulseTimer / 200) * 0.5;

            if (powerUp.type === 'shield') {
                // Draw shield power-up
                this.ctx.fillStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
                this.ctx.beginPath();
                this.ctx.arc(
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2,
                    (powerUp.width / 2) * pulseScale,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                // Draw 'S' inside shield
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 20px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(
                    'S',
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2
                );
            } else if (powerUp.type === 'fastLaser') {
                // Draw laser power-up
                this.ctx.fillStyle = `rgba(0, 150, 255, ${pulseAlpha})`;
                this.ctx.fillRect(
                    powerUp.x - (powerUp.width * (pulseScale - 1)) / 2,
                    powerUp.y - (powerUp.height * (pulseScale - 1)) / 2,
                    powerUp.width * pulseScale,
                    powerUp.height * pulseScale
                );

                // Draw 'L' inside laser
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 20px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(
                    'L',
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2
                );
            } else if (powerUp.type === 'chargeGun') {
                // Draw charge gun power-up
                this.ctx.fillStyle = `rgba(128, 0, 128, ${pulseAlpha})`; // Purple
                this.ctx.beginPath();
                this.ctx.arc(
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2,
                    (powerUp.width / 2) * pulseScale,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                // Draw 'C' inside charge gun
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 20px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(
                    'C',
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2
                );
            }

            // Draw outline
            this.ctx.strokeStyle = powerUp.type === 'chargeGun' ? '#800080' : '#0000ff'; // Purple for charge gun, blue for others
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
                powerUp.x - (powerUp.width * (pulseScale - 1)) / 2,
                powerUp.y - (powerUp.height * (pulseScale - 1)) / 2,
                powerUp.width * pulseScale,
                powerUp.height * pulseScale
            );
        }

        // Draw player bullets
        for (const bullet of this.player.bullets) {
            if (bullet.type === 'charge') {
                // Draw glow effect
                this.ctx.shadowColor = 'rgba(128, 0, 128, 0.8)';
                this.ctx.shadowBlur = 15;
                this.ctx.fillStyle = '#ff00ff'; // Bright purple
                this.ctx.beginPath();
                this.ctx.arc(
                    bullet.x,
                    bullet.y,
                    bullet.width / 2,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
                // Reset shadow
                this.ctx.shadowBlur = 0;
            } else if (bullet.type === 'laser') {
                this.ctx.fillStyle = 'rgba(0, 150, 255, 1)';
                this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            } else {
                this.ctx.fillStyle = '#ffff00';
                this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            }
        }

        // Draw enemies
        for (const enemy of this.enemies) {
            if (enemy.isUFO) {
                // Draw UFO
                this.ctx.fillStyle = '#808080'; // Grey color for UFO
                this.ctx.beginPath();
                this.ctx.arc(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    enemy.width / 2,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                // Draw UFO details
                this.ctx.strokeStyle = '#ffff00'; // Yellow outline
                this.ctx.lineWidth = 3; // Thicker line for better visibility
                this.ctx.beginPath();
                this.ctx.arc(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    enemy.width / 3,
                    0,
                    Math.PI * 2
                );
                this.ctx.stroke();

                // Draw health bars
                const healthBarWidth = enemy.width;
                const healthBarHeight = 4;
                const healthBarX = enemy.x;
                const healthBarY = enemy.y - 10;

                // Background
                this.ctx.fillStyle = '#333333';
                this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

                // Health
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(
                    healthBarX,
                    healthBarY,
                    (healthBarWidth * enemy.health) / 5,
                    healthBarHeight
                );
            } else if (enemy.isBlob) {
                // Draw blob body
                this.ctx.fillStyle = '#800080'; // Purple color for blob
                this.ctx.beginPath();
                this.ctx.arc(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    enemy.width / 2,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                // Draw evil eye
                const eyeX = enemy.x + enemy.width / 2;
                const eyeY = enemy.y + enemy.height / 2;
                const eyeSize = enemy.width * 0.4; // 40% of blob size

                // Draw eye glow
                this.ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
                this.ctx.shadowBlur = 15;

                // Draw eye white
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2);
                this.ctx.fill();

                // Draw eye iris
                this.ctx.fillStyle = '#ff0000';
                this.ctx.beginPath();
                this.ctx.arc(eyeX, eyeY, eyeSize * 0.7, 0, Math.PI * 2);
                this.ctx.fill();

                // Draw eye pupil
                this.ctx.fillStyle = '#000000';
                this.ctx.beginPath();
                this.ctx.arc(eyeX, eyeY, eyeSize * 0.4, 0, Math.PI * 2);
                this.ctx.fill();

                // Draw eye shine
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(
                    eyeX - eyeSize * 0.2,
                    eyeY - eyeSize * 0.2,
                    eyeSize * 0.1,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                // Reset shadow
                this.ctx.shadowBlur = 0;

                // Draw tentacles
                const tentacleCount = 8;
                const baseLength = 120;
                const wiggleAmount = 15;
                const tentacleWidth = 5;

                for (let i = 0; i < tentacleCount; i++) {
                    const baseAngle = (Math.PI * 2 * i) / tentacleCount + enemy.tentacleAngle;

                    // Calculate extension/retraction
                    const extension = Math.sin(enemy.tentaclePhase + i * 0.5) * 0.5 + 0.5;
                    const length = baseLength * (0.7 + extension * 0.3);

                    // Calculate wiggle
                    const wiggle = Math.sin(enemy.wigglePhase + i * 0.8) * wiggleAmount;
                    const angle = baseAngle + wiggle * 0.1;

                    // Start tentacle from the edge of the blob instead of center
                    const blobRadius = enemy.width / 2;
                    const startX = enemy.x + enemy.width / 2 + Math.cos(angle) * blobRadius;
                    const startY = enemy.y + enemy.height / 2 + Math.sin(angle) * blobRadius;

                    // Calculate control points for the curve
                    const midLength = length * 0.5;
                    const controlAngle1 = angle + Math.sin(enemy.wigglePhase + i * 0.8) * 0.3;
                    const controlAngle2 = angle + Math.sin(enemy.wigglePhase + i * 0.8 + 0.5) * 0.3;

                    const controlX1 = startX + Math.cos(controlAngle1) * midLength;
                    const controlY1 = startY + Math.sin(controlAngle1) * midLength;
                    const controlX2 = startX + Math.cos(controlAngle2) * midLength * 1.5;
                    const controlY2 = startY + Math.sin(controlAngle2) * midLength * 1.5;

                    const endX = startX + Math.cos(angle) * length;
                    const endY = startY + Math.sin(angle) * length;

                    // Use different shades of purple for each tentacle
                    const hue = 270 + (i * 5); // Smaller hue variation to stay in purple range
                    const saturation = 85 + (i % 2 * 15); // Slightly higher base saturation
                    const lightness = 35 + (i % 3 * 15); // More contrast in lightness
                    const tentacleColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

                    // Draw tentacle
                    this.ctx.strokeStyle = tentacleColor;
                    this.ctx.lineWidth = tentacleWidth;
                    this.ctx.beginPath();
                    this.ctx.moveTo(startX, startY);
                    this.ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
                    this.ctx.stroke();

                    // Draw tentacle tip with slightly darker shade
                    this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`;
                    this.ctx.beginPath();
                    this.ctx.arc(endX, endY, tentacleWidth / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                // Draw health bars
                const healthBarWidth = enemy.width;
                const healthBarHeight = 4;
                const healthBarX = enemy.x;
                const healthBarY = enemy.y - 10;

                // Background
                this.ctx.fillStyle = '#333333';
                this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

                // Health
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(
                    healthBarX,
                    healthBarY,
                    (healthBarWidth * enemy.health) / 8,
                    healthBarHeight
                );
            } else {
                // Draw regular enemy as a circle
                this.ctx.fillStyle = enemy.isMoving ? '#ff0000' : '#ff8800';
                this.ctx.beginPath();
                this.ctx.arc(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    enemy.width / 2,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                if (enemy.isMoving) {
                    // Draw evil eyes for red monsters
                    // Left eye
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath();
                    this.ctx.arc(
                        enemy.x + 10,
                        enemy.y + 15,
                        5,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.fill();

                    // Left pupil
                    this.ctx.fillStyle = '#000000';
                    this.ctx.beginPath();
                    this.ctx.arc(
                        enemy.x + 10,
                        enemy.y + 15,
                        2,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.fill();

                    // Right eye
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath();
                    this.ctx.arc(
                        enemy.x + 30,
                        enemy.y + 15,
                        5,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.fill();

                    // Right pupil
                    this.ctx.fillStyle = '#000000';
                    this.ctx.beginPath();
                    this.ctx.arc(
                        enemy.x + 30,
                        enemy.y + 15,
                        2,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.fill();
                } else {
                    // Draw sleepy eyes (smiley mouths) for orange monsters
                    // Left eye
                    this.ctx.strokeStyle = '#000000';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(
                        enemy.x + 10,
                        enemy.y + 15,
                        5,
                        0,
                        Math.PI
                    );
                    this.ctx.stroke();

                    // Right eye
                    this.ctx.beginPath();
                    this.ctx.arc(
                        enemy.x + 30,
                        enemy.y + 15,
                        5,
                        0,
                        Math.PI
                    );
                    this.ctx.stroke();
                }
            }
        }

        // Draw enemy bullets
        for (const bullet of this.enemyBullets) {
            if (bullet.type === 'ufo') {
                this.ctx.fillStyle = '#ff00ff'; // Purple for UFO bullets
                this.ctx.beginPath();
                this.ctx.arc(
                    bullet.x,
                    bullet.y,
                    bullet.width / 2,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            } else if (bullet.type === 'blob') {
                // Draw glow effect for blob bullets
                this.ctx.shadowColor = 'rgba(255, 0, 255, 0.8)';
                this.ctx.shadowBlur = 15;
                this.ctx.fillStyle = '#ff00ff'; // Bright magenta
                this.ctx.beginPath();
                this.ctx.arc(
                    bullet.x,
                    bullet.y,
                    bullet.width / 2,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
                // Reset shadow
                this.ctx.shadowBlur = 0;
            } else {
                this.ctx.fillStyle = '#ff00ff';
                this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            }
        }

        // Draw obstacles
        this.drawObstacles();

        // Draw charge meter if using charge gun
        if (this.player.weapon.type === 'chargeGun') {
            const meterWidth = 100;
            const meterHeight = 10;
            const meterX = this.player.x + (this.player.width - meterWidth) / 2; // Center under player
            const meterY = this.player.y + this.player.height + 10; // 10 pixels below player

            // Draw background
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

            // Draw charge level
            this.ctx.fillStyle = '#800080'; // Purple
            this.ctx.fillRect(
                meterX,
                meterY,
                (meterWidth * this.player.chargeLevel) / this.player.maxCharge,
                meterHeight
            );

            // Draw outline
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
        }
    }

    animate(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame((time) => this.animate(time));
    }

    restart() {
        this.gameOver = false;
        this.isGameOverSequence = false;
        this.score = 0;
        this.shields = 3;
        this.isInvulnerable = false;
        this.player.y = this.canvas.height / 2;
        this.player.velocity = 0;
        this.player.bullets = [];
        this.player.weapon = {
            type: 'default',
            ammo: 0,
            cooldown: 400
        };
        this.enemies = [];
        this.enemyBullets = [];
        this.powerUps = [];
        this.obstacles = [];
        this.obstacleTimer = 0;
        this.enemyTimer = 0;
        this.powerUpTimer = 0;
        this.explosionParticles = [];
        this.explosionTimer = 0;
        this.scrollSpeed = 2;
        this.hasUFO = false; // Reset UFO state on restart
        this.hasBlob = false; // Reset blob state on restart

        // Reset star field
        this.stars = {
            far: this.createStarLayer(150, 0.2, 1),
            medium: this.createStarLayer(80, 0.4, 2),
            close: this.createStarLayer(20, 0.8, 3)
        };

        this.gameOverElement.classList.add('hidden');
    }

    releaseChargeShot() {
        if (this.player.weapon.type === 'chargeGun') {
            if (this.player.weapon.ammo > 0) {
                const chargeLevel = this.player.chargeLevel;
                // Increased base number of bullets and made it scale more with charge level
                const numBullets = Math.floor(chargeLevel / 10) + 5; // Now starts with 5 bullets and scales up to 15 at full charge
                const angleStep = (Math.PI * 2) / numBullets; // Full 360 degrees

                for (let i = 0; i < numBullets; i++) {
                    const angle = angleStep * i;
                    const speed = 8; // Reduced from 10 to 8 for slower bullets

                    this.player.bullets.push({
                        x: this.player.x + this.player.width / 2,
                        y: this.player.y + this.player.height / 2,
                        width: 30, // Doubled from 15 to 30
                        height: 30, // Doubled from 15 to 30
                        dx: Math.cos(angle) * speed,
                        dy: Math.sin(angle) * speed,
                        type: 'charge'
                    });
                }

                this.player.weapon.ammo--; // Decrease ammo by 1
                this.player.chargeLevel = 0;
                this.sounds.laser.currentTime = 0;
                this.sounds.laser.play();

                // Switch back to default weapon when out of ammo
                if (this.player.weapon.ammo <= 0) {
                    this.player.weapon = {
                        type: 'default',
                        ammo: 0,
                        cooldown: 400
                    };
                }
            }
        }
    }

    // Add new method to initialize audio context
    initializeAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Modify generateEnemyShotSound to check for audio context
    generateEnemyShotSound() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Start with higher frequency and sweep down
        const startFreq = 800;
        const endFreq = 200;
        const duration = 0.05; // Shorter duration for zip effect

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + duration);

        // Quick attack and decay with reduced volume
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.001);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Start and stop the sound
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Modify generateUFOShotSound to check for audio context
    generateUFOShotSound() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // More dramatic frequency sweep for UFO
        const startFreq = 1200;
        const endFreq = 300;
        const duration = 0.08; // Slightly longer for UFO

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + duration);

        // Quick attack and decay with reduced volume
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.075, this.audioContext.currentTime + 0.001);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Start and stop the sound
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Add new method to generate blob shot sound
    generateBlobShotSound() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // More dramatic frequency sweep for blob
        const startFreq = 1500;
        const endFreq = 200;
        const duration = 0.1; // Longer for blob

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + duration);

        // Quick attack and decay with reduced volume
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.001);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Start and stop the sound
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
