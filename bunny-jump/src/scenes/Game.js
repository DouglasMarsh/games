import Phaser from '../lib/phaser.js'
import Carrot from '../game/Carrot.js'

export default class Game extends Phaser.Scene {
    /** @type {Phaser.Physics.Arcade.StaticGroup} */
    platforms
    /** @type {Phaser.Physics.Arcade.Sprite} */
    player
    /** @type {boolean} */
    isPlayerOnPlatform = false
    /** @type {Phaser.Physics.Arcade.Group} */
    carrots
    /** @type {number} */
    carrotsCollected
    /** @type {Phaser.GameObjects.Text} */
    carrotsCollectedText

    /** @type {Phaser.Types.Input.Keyboard.CursorKeys} */
    cursors

    constructor(){
        super('game')
    }
    init() {
        this.carrotsCollected = 0
    }
    preload(){
        this.load.image('background','assets/images/bg_layer1.png')
        this.load.image('platform', 'assets/images/ground_grass.png')
        this.load.image('bunny-stand', 'assets/images/bunny2_stand.png')
        this.load.image('bunny-jump', 'assets/images/bunny2_jump.png')
        this.load.image('carrot', 'assets/images/carrot.png')

        this.load.audio('jump', 'assets/sfx/jump.ogg')
        this.load.audio('collect-carrot', 'assets/sfx/collect-carrot.ogg')

        this.cursors = this.input.keyboard.createCursorKeys()
    }
    create(){
        // background
        this.add.image(240, 320, 'background')
            .setScrollFactor(1,0)
        
        // platforms
        this.platforms = this.physics.add.staticGroup()
        for(let i = 0; i < 5; i++){
            const x = Phaser.Math.Between( 80, 400)
            const y = 150 * i

            /** @type {Phaser.Physics.Arcade.Sprite} */
            const platform = this.platforms.create(x,y,'platform')
            platform.scale = 0.5

            /** @type {Phaser.Physics.Arcade.StaticBody} */
            const body = platform.body
            body.updateFromGameObject()
        }

        

        // player
        this.player = this.physics.add.sprite(240, 320, 'bunny-stand')
                           .setScale(0.5)
        this.physics.add.collider(
            this.player, this.platforms, this._playerTouchedPlatform, undefined, this)
        

        // only check down collisions for player
        this.player.body.checkCollision.up = false
        this.player.body.checkCollision.left = false
        this.player.body.checkCollision.right = false      
        
        // carrots
        this.carrots = this.physics.add.group({
            classType: Carrot
        })
        this.physics.add.collider(this.platforms, this.carrots)
        this.physics.add.overlap(
            this.player, this.carrots, this._collectCarrot, undefined, this
        )
        const style = { color: '#000', fontSize: 24 } 
        this.carrotsCollectedText = this.add.text(240, 10, 'Carrots: 0', style)
                .setScrollFactor(0)
                .setOrigin(0.5, 0)


        // setup camera to follow player but establish dead-zone
        // so camera doesn't follow left/right
        this.cameras.main.startFollow(this.player)
        this.cameras.main.setDeadzone(this.scale.width * 1.5)
    }
    update(t, dt){

        this.platforms.children.iterate(child => {
            /** @type {Phaser.Physics.Arcade.Sprite} */
            const platform = child
            const scrollY = this.cameras.main.scrollY
            if (platform.y >= scrollY + 700){
                platform.y = scrollY - Phaser.Math.Between(50, 75)
                platform.body.updateFromGameObject()
                this._addCarrotAbove( platform )
            }
        })

        
        // if player is in middle of a jump, change texture to stand
        const vy = this.player.body.velocity.y
        if(vy > 0 && this.player.texture.key !== 'bunny-stand'){
            this.player.setTexture('bunny-stand')
        }

        const isTouchingDown = this.player.body.touching.down
        // left and right input logic
        if (this.cursors.left.isDown && !this.isPlayerOnPlatform){
            this.player.setVelocityX(-200)
        }
        else if (this.cursors.right.isDown && !this.isPlayerOnPlatform){
            this.player.setVelocityX(200)
        }
        else{
            // stop movement if not left or right
            this.player.setVelocityX(0)
        }

        this._horizontalWrap(this.player)

        // check for game over
        const bottom = this._findBottomPlatform().y + 200;
        if( this.player.y > bottom ) {
            this.scene.start('game-over')
        }
    }
    /**
     * @param {Phaser.GameObjects.Sprite} sprite
     */
    _horizontalWrap(sprite){
        const halfWidth = sprite.displayWidth * 0.5
        const gameWidth = this.scale.width
        if (sprite.x < -halfWidth){
            sprite.x = gameWidth + halfWidth
        }
        else if (sprite.x > gameWidth + halfWidth){
            sprite.x = -halfWidth
        }
    }
    /**
     * @param {Phaser.GameObjects.Sprite} sprite
     */
    _addCarrotAbove( sprite ){
        const y = sprite.y - sprite.displayHeight;

        /** @type {Phaser.Arcade.Sprite} */
        const carrot = this.carrots.get(sprite.x, y, 'carrot');
        carrot.setActive(true);
        carrot.setVisible(true);

        this.add.existing(carrot);

        // update the physics body size
        carrot.body.setSize(carrot.width, carrot.height);

        // make sure body is enabled in physics
        this.physics.world.enable( carrot );
        return carrot;

    }
    
    /**
     * @param {Phaser.Physics.Arcade.Sprite} player 
     * @param {Phaser.Physics.Arcade.Sprite} platform
     */
     _playerTouchedPlatform(player, platform){
        this.isPlayerOnPlatform = player.body.touching.down;
        if(this.isPlayerOnPlatform ){
            // jump straight up
            player.setVelocityY(-300)
            player.setTexture('bunny-jump')

            this.sound.play('jump')
        }
        
    }
    /**
     * @param {Phaser.Physics.Arcade.Sprite} player 
     * @param {Carrot} carrot 
     */
    _collectCarrot(player, carrot){
        this.carrots.killAndHide(carrot);
        this.physics.world.disableBody(carrot.body);
        
        this.sound.play('collect-carrot')

        this.carrotsCollected ++;
        this.carrotsCollectedText.text = `Carrots: ${this.carrotsCollected}`;
    }
    
    _findBottomPlatform(){
        const platforms = this.platforms.getChildren();
        let bottom = platforms[0];
        for( let i = 1; i < platforms.length; ++i) {
            const platform = platforms[i];
            if( platform.y < bottom.y) {
                continue;
            }
            bottom = platform;
        }

        return bottom;
    }
}