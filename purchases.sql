-- Tabela zakupów
CREATE DATABASE IF NOT EXISTS premiummc;
USE premiummc;

CREATE TABLE purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  nick VARCHAR(16) NOT NULL,
  rank VARCHAR(64) NOT NULL,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_order (order_id),
  INDEX idx_nick (nick),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- Przykładowe dane testowe
INSERT INTO purchases (order_id, nick, rank, status) VALUES 
('test_123', 'TestPlayer', 'vip', 'completed'),
('test_124', 'InvalidNick!', 'premium', 'failed');
