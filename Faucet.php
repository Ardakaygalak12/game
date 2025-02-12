<?php
require_once 'config.php';

function sendPayment($address, $amount, $currency = 'DGB') {
    $url = 'https://faucetpay.io/api/v1/send';
    
    $data = array(
        'api_key' => FAUCETPAY_API_KEY,
        'amount' => $amount,
        'to' => $address,
        'currency' => $currency
    );

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}
