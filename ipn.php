<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw_post_data = file_get_contents('php://input');
    $json_data = json_decode($raw_post_data, true);
    
    // Doğrulama işlemleri
    if (isset($json_data['api_key']) && $json_data['api_key'] === FAUCETPAY_API_KEY) {
        // Ödeme doğrulandı
        http_response_code(200);
        echo 'OK';
        
        // Log tutmak için
        file_put_contents('ipn_log.txt', date('Y-m-d H:i:s') . ' - Success: ' . $raw_post_data . PHP_EOL, FILE_APPEND);
    } else {
        http_response_code(403);
        echo 'Invalid API Key';
        
        // Hata loglamak için
        file_put_contents('ipn_log.txt', date('Y-m-d H:i:s') . ' - Error: Invalid API Key' . PHP_EOL, FILE_APPEND);
    }
}
