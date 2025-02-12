<?php
require_once 'config.php';
require_once 'faucet.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $address = $_POST['address'];
    
    // Basit doğrulama
    if (empty($address)) {
        echo json_encode(['error' => 'Address is required']);
        exit;
    }
    
    // Random ödeme miktarı
    $amount = rand(MIN_CLAIM * 100000000, MAX_CLAIM * 100000000) / 100000000;
    
    $result = sendPayment($address, $amount);
    
    if (isset($result['status']) && $result['status'] == 200) {
        echo json_encode([
            'success' => true,
            'message' => 'Payment sent successfully',
            'amount' => $amount
        ]);
        
        // Başarılı ödemeyi logla
        file_put_contents('payment_log.txt', date('Y-m-d H:i:s') . " - Success: $amount BTC sent to $address" . PHP_EOL, FILE_APPEND);
    } else {
        echo json_encode([
            'error' => 'Payment failed',
            'message' => $result['message'] ?? 'Unknown error'
        ]);
        
        // Hatayı logla
        file_put_contents('payment_log.txt', date('Y-m-d H:i:s') . " - Error: Payment failed for $address" . PHP_EOL, FILE_APPEND);
    }
}
