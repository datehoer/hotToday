import requests

url = "https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1&source=6&main_billboard_count=5&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=4&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=300&webid=7320841569496942120"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

headers = {
    "cookie": "ttwid=1%7Ckl-Iv9I9-9Z-b0MYMjqMtRDu2fzmgTEVJYlrhaNNe9s%7C1704516269%7Cb52ccdc2bc200194db0d3865e382dbecad0cea1afd98caba06071b29cd686c1e; csrf_session_id=ba967827ba9dd02ecc812b2985404927; __ac_nonce=065a27a2c0071facd16b5; __ac_signature=_02B4Z6wo00f01DvzPOAAAIDBMdXnSzMysuw70zhAAGtlf0; douyin.com; device_web_cpu_core=4; device_web_memory_size=8; architecture=amd64; dy_swidth=1920; dy_sheight=1080; FORCE_LOGIN=%7B%22videoConsumedRemainSeconds%22%3A180%7D; strategyABtestKey=%221705146927.992%22; s_v_web_id=verify_lrc0ge4l_Vg9Sp9oe_OjCx_4eGO_8iDy_orBSfaiRLcRx; volume_info=%7B%22isUserMute%22%3Afalse%2C%22isMute%22%3Afalse%2C%22volume%22%3A0.5%7D; passport_csrf_token=8f0dd7037565699180777b928294a243; passport_csrf_token_default=8f0dd7037565699180777b928294a243; xgplayer_user_id=85571375636; bd_ticket_guard_client_web_domain=2; ttcid=08a6f64676b84491900a3aa79bbd7c2c25; tt_scid=nMImitf2o80zY-aQqxRSTiRV8ur3cfyvRbs4E37zhZ-AN9MVwWVbGT2wWYB5d5DE18a8; xg_device_score=6.186646187672321; download_guide=%221%2F20240113%2F0%22; stream_recommend_feed_params=%22%7B%5C%22cookie_enabled%5C%22%3Atrue%2C%5C%22screen_width%5C%22%3A1920%2C%5C%22screen_height%5C%22%3A1080%2C%5C%22browser_online%5C%22%3Atrue%2C%5C%22cpu_core_num%5C%22%3A4%2C%5C%22device_memory%5C%22%3A8%2C%5C%22downlink%5C%22%3A10%2C%5C%22effective_type%5C%22%3A%5C%224g%5C%22%2C%5C%22round_trip_time%5C%22%3A150%7D%22; stream_player_status_params=%22%7B%5C%22is_auto_play%5C%22%3A0%2C%5C%22is_full_screen%5C%22%3A0%2C%5C%22is_full_webscreen%5C%22%3A0%2C%5C%22is_mute%5C%22%3A0%2C%5C%22is_speed%5C%22%3A1%2C%5C%22is_visible%5C%22%3A1%7D%22; msToken=RQ7Mg1f7iFmbTjf3aiPGetdCMoa5cxeLKoeORPv1x0YWPQaY9TwVEdpWz_xDY35X7tjPHTsK4ycVn0cQhxyB-DLIXXq9PJT6DKG9IudRJBdPAnzjmQ==; home_can_add_dy_2_desktop=%221%22; IsDouyinActive=true; bd_ticket_guard_client_data=eyJiZC10aWNrZXQtZ3VhcmQtdmVyc2lvbiI6MiwiYmQtdGlja2V0LWd1YXJkLWl0ZXJhdGlvbi12ZXJzaW9uIjoxLCJiZC10aWNrZXQtZ3VhcmQtcmVlLXB1YmxpYy1rZXkiOiJCT2pwZnhpY2pQSmxselBBekdJK3FNRWIzRGtubHlhSERBUTdLMEtCYWhPeEhzZXd1c1FVZHhtdlYyRXBZc1F2SndFMnlIam4wL2x5aUIzcDBlTEIraVk9IiwiYmQtdGlja2V0LWd1YXJkLXdlYi12ZXJzaW9uIjoxfQ%3D%3D; msToken=ufaoK0PoecCjE5BO6kxzMoP78rWwuLgfWxD17rPmKkG4nTZCgd4e3iWFy8wJGYcsGLW82TEwQUkl4K5Un9dh_kfoaRylLznVbR1nA6yo-3RzPmm_tQ==",
    "referer": "https://www.douyin.com/user",
    "user-agent": UA
}
data = {
    "url": url,
    "user_agent": UA
}
res = requests.post("http://127.0.0.1:8787/X-Bogus", json=data)

res = requests.get(res.json()['new_url'], headers=headers)
data = []
res_json = res.json()
if "data" in res_json:
    res_data = res_json['data']
    if "word_list" in res_data:
        word_list = res_data['word_list']
        for word in word_list:
            title = word['word']
            link = "https://www.douyin.com/search/" + title
            hotScore = word['hot_value']
            data.append({
                "title": title,
                "link": link,
                "hotScore": hotScore
            })


print(data)