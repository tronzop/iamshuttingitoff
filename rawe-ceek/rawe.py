import os
import json
from pathlib import Path

# Create project directory structure
project_root = Path("rawe-ceek-python")
project_root.mkdir(exist_ok=True)

# Create subdirectories
(project_root / "src").mkdir(exist_ok=True)
(project_root / "assets").mkdir(exist_ok=True)

# 1. CREATE SETTINGS.PY
settings_content = '''# Game Configuration Settings

# Screen dimensions
SCREEN_WIDTH = 1280
SCREEN_HEIGHT = 720
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (226, 27, 27)
GOLD = (255, 215, 0)
DARK_BG = (7, 24, 39)

# Player Settings
PLAYER_SPEED = 240
PLAYER_RADIUS = 14
PLAYER_WIDTH = 46
PLAYER_HEIGHT = 18

# Boost Settings
MAX_BOOST = 100
BOOST_DRAIN_RATE = 60      # per second
BOOST_RECHARGE_RATE = 30   # per second
BOOST_SPEED_MULTIPLIER = 1.5

# Enemy Settings
BASE_BPM = 90
SPAWN_INTERVAL = 1.6
DIFFICULTY_INCREASE = 1.8

# Tire Compounds
TIRE_COMPOUNDS = [
    {"id": "soft", "name": "Soft", "color": (255, 92, 92), "speed_mult": 1.15},
    {"id": "medium", "name": "Medium", "color": (255, 209, 0), "speed_mult": 1.0},
    {"id": "hard", "name": "Hard", "color": (244, 244, 244), "speed_mult": 0.9},
    {"id": "inter", "name": "Intermediate", "color": (0, 168, 107), "speed_mult": 1.02},
    {"id": "wet", "name": "Wet", "color": (0, 128, 255), "speed_mult": 0.95},
]
'''

# 2. CREATE MAIN.PY
main_content = '''import pygame
import sys
from src.game import Game
import src.settings as cfg

def main():
    pygame.init()
    pygame.display.set_caption("Rawe Ceek - F1 Racing")
    
    try:
        game = Game()
        game.run()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        pygame.quit()
        sys.exit()

if __name__ == "__main__":
    main()
'''

# 3. CREATE PLAYER.PY
player_content = '''import pygame
import math
import src.settings as cfg

class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.vx = 0
        self.vy = 0
        self.speed = cfg.PLAYER_SPEED
        self.radius = cfg.PLAYER_RADIUS
        
        # Rotation
        self.angle = 0
        self.target_angle = 0
        self.wheel_rotation = 0
        
        # Boost system
        self.boost_energy = cfg.MAX_BOOST
        self.boost_active = False
        
        # Visual
        self.livery = cfg.RED
        self.accent = cfg.GOLD
        self.exhaust_intensity = 0
        
    def update(self, dt, keys):
        self._update_boost(dt, keys)
        
        dx, dy = 0, 0
        if keys.get('left'):
            dx -= 1
        if keys.get('right'):
            dx += 1
        if keys.get('up'):
            dy -= 1
        if keys.get('down'):
            dy += 1
            
        if dx != 0 or dy != 0:
            length = math.hypot(dx, dy)
            vx = (dx / length) * self.speed
            vy = (dy / length) * self.speed
            
            # Apply boost multiplier
            if self.boost_active and self.boost_energy > 0:
                vx *= cfg.BOOST_SPEED_MULTIPLIER
                vy *= cfg.BOOST_SPEED_MULTIPLIER
                
            self.vx = vx
            self.vy = vy
            
            self.x += vx * dt
            self.y += vy * dt
            self.target_angle = math.atan2(vy, vx)
            self.wheel_rotation += math.hypot(vx, vy) * 0.03 * dt * 60
            self.exhaust_intensity = min(1.0, math.hypot(vx, vy) / 600)
        else:
            self.vx = 0
            self.vy = 0
            
        # Bound check
        self.x = max(self.radius, min(cfg.SCREEN_WIDTH - self.radius, self.x))
        self.y = max(self.radius, min(cfg.SCREEN_HEIGHT - self.radius, self.y))
        
        # Smooth angle
        ang_diff = ((self.target_angle - self.angle + math.pi) % (math.pi * 2)) - math.pi
        self.angle += ang_diff * min(1.0, dt * 6)
        
    def _update_boost(self, dt, keys):
        moving = keys.get('up') or keys.get('down') or keys.get('left') or keys.get('right')
        if keys.get('boost') and self.boost_energy > 0 and moving:
            self.boost_active = True
            self.boost_energy = max(0, self.boost_energy - cfg.BOOST_DRAIN_RATE * dt)
        else:
            self.boost_active = False
            self.boost_energy = min(cfg.MAX_BOOST, self.boost_energy + cfg.BOOST_RECHARGE_RATE * dt)
            
    def draw(self, surface):
        # Car body
        pygame.draw.circle(surface, self.livery, (int(self.x), int(self.y)), self.radius)
        pygame.draw.circle(surface, self.accent, (int(self.x), int(self.y)), int(self.radius * 0.7))
        
        # Boost bar
        bar_width = 150
        bar_height = 12
        bar_x = 20
        bar_y = 20
        boost_pct = self.boost_energy / cfg.MAX_BOOST
        
        pygame.draw.rect(surface, (50, 50, 50), (bar_x, bar_y, bar_width, bar_height))
        
        if boost_pct < 0.2:
            color = cfg.RED
        elif boost_pct < 0.5:
            color = cfg.GOLD
        else:
            color = (0, 255, 0)
            
        pygame.draw.rect(surface, color, (bar_x, bar_y, bar_width * boost_pct, bar_height))
        pygame.draw.rect(surface, cfg.WHITE, (bar_x, bar_y, bar_width, bar_height), 1)
        
        font = pygame.font.Font(None, 11)
        label = font.render("BOOST", True, cfg.WHITE)
        surface.blit(label, (bar_x, bar_y - 14))
'''

# 4. CREATE ENEMY.PY
enemy_content = '''import pygame
import math
import random
import src.settings as cfg

class Enemy:
    def __init__(self, x, y, vx, vy, radius, compound):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.radius = radius
        self.compound = compound
        
    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        
    def draw(self, surface):
        pygame.draw.circle(surface, self.compound['color'], (int(self.x), int(self.y)), self.radius)
        pygame.draw.circle(surface, (33, 33, 33), (int(self.x), int(self.y)), int(self.radius * 0.48))

class EnemyManager:
    def __init__(self):
        self.enemies = []
        self.spawn_timer = 0
        self.spawn_interval = cfg.SPAWN_INTERVAL
        
    def spawn_enemy(self, player, elapsed):
        edge = random.randint(0, 3)
        if edge == 0:
            x, y = -30, random.uniform(0, cfg.SCREEN_HEIGHT)
        elif edge == 1:
            x, y = cfg.SCREEN_WIDTH + 30, random.uniform(0, cfg.SCREEN_HEIGHT)
        elif edge == 2:
            x, y = random.uniform(0, cfg.SCREEN_WIDTH), -30
        else:
            x, y = random.uniform(0, cfg.SCREEN_WIDTH), cfg.SCREEN_HEIGHT + 30
            
        compound = random.choice(cfg.TIRE_COMPOUNDS)
        angle_to_player = math.atan2(player.y - y, player.x - x)
        base_speed = random.uniform(60, 160) + min(200, elapsed * 4)
        speed = base_speed * compound['speed_mult']
        
        vx = math.cos(angle_to_player + random.uniform(-0.5, 0.5)) * speed
        vy = math.sin(angle_to_player + random.uniform(-0.5, 0.5)) * speed
        radius = random.uniform(10, 28) * (1 + min(2, elapsed / 30))
        
        self.enemies.append(Enemy(x, y, vx, vy, radius, compound))
        
    def update(self, dt, player, elapsed):
        self.spawn_timer -= dt
        if self.spawn_timer <= 0:
            self.spawn_enemy(player, elapsed)
            self.spawn_interval = max(0.6, 1.6 - elapsed / 60)
            self.spawn_timer = self.spawn_interval
            
        for enemy in self.enemies:
            enemy.update(dt)
            
        self.enemies = [e for e in self.enemies if -100 < e.x < cfg.SCREEN_WIDTH + 100 and -100 < e.y < cfg.SCREEN_HEIGHT + 100]
        
    def draw(self, surface):
        for enemy in self.enemies:
            enemy.draw(surface)

    def check_collision(self, player):
        for enemy in self.enemies:
            dist = math.hypot(enemy.x - player.x, enemy.y - player.y)
            if dist < (enemy.radius + player.radius):
                return True
        return False
'''

# 5. CREATE PARTICLES.PY
particles_content = '''import pygame
import random

class Particle:
    def __init__(self, x, y, vx, vy, size, life):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.size = size
        self.max_life = life
        self.life = life
        
    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.life -= dt
        
    def draw(self, surface):
        alpha = int(255 * (self.life / self.max_life))
        color = (200, 200, 200, alpha)
        pygame.draw.circle(surface, color[:3], (int(self.x), int(self.y)), int(self.size))

class ParticleSystem:
    def __init__(self):
        self.particles = []
        
    def spawn(self, x, y, vx, vy, size, life):
        self.particles.append(Particle(x, y, vx, vy, size, life))
        
    def update(self, dt):
        for p in self.particles:
            p.update(dt)
        self.particles = [p for p in self.particles if p.life > 0]
        
    def draw(self, surface):
        for p in self.particles:
            p.draw(surface)
'''

# 6. CREATE AUDIO.PY
audio_content = '''class AudioManager:
    def __init__(self):
        self.music_on = False
        
    def toggle_music(self):
        self.music_on = not self.music_on
        
    def play_kick(self):
        pass
        
    def play_snare(self):
        pass
        
    def play_hat(self):
        pass
'''

# 7. CREATE GAME.PY
game_content = '''import pygame
import math
import src.settings as cfg
from src.player import Player
from src.enemy import EnemyManager
from src.particles import ParticleSystem
from src.audio import AudioManager

class Game:
    def __init__(self):
        self.screen = pygame.display.set_mode((cfg.SCREEN_WIDTH, cfg.SCREEN_HEIGHT))
        self.clock = pygame.time.Clock()
        self.running = True
        self.paused = False
        
        self.player = Player(cfg.SCREEN_WIDTH / 2, cfg.SCREEN_HEIGHT / 2)
        self.enemy_manager = EnemyManager()
        self.particle_system = ParticleSystem()
        self.audio_manager = AudioManager()
        
        self.elapsed = 0.0
        self.score = 0
        self.high_score = 0
        self.game_over = False
        self.game_over_time = 0.0
        
        self.keys = {
            'up': False, 'down': False, 'left': False, 'right': False,
            'boost': False
        }
        
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                self._handle_keydown(event)
            elif event.type == pygame.KEYUP:
                self._handle_keyup(event)
                
    def _handle_keydown(self, event):
        if event.key == pygame.K_UP or event.key == pygame.K_w:
            self.keys['up'] = True
        elif event.key == pygame.K_DOWN or event.key == pygame.K_s:
            self.keys['down'] = True
        elif event.key == pygame.K_LEFT or event.key == pygame.K_a:
            self.keys['left'] = True
        elif event.key == pygame.K_RIGHT or event.key == pygame.K_d:
            self.keys['right'] = True
        elif event.key == pygame.K_SPACE:
            self.keys['boost'] = True
        elif event.key == pygame.K_p:
            self.paused = not self.paused
        elif event.key == pygame.K_m:
            self.audio_manager.toggle_music()
            
    def _handle_keyup(self, event):
        if event.key == pygame.K_UP or event.key == pygame.K_w:
            self.keys['up'] = False
        elif event.key == pygame.K_DOWN or event.key == pygame.K_s:
            self.keys['down'] = False
        elif event.key == pygame.K
