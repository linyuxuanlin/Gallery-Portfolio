// 通知系统
const notificationSystem = {
  container: null,
  notificationCount: 0,
  maxNotifications: 3,
  init: function() {
    // 创建通知容器
    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
    
    // 初始化SSE连接
    this.initEventSource();
    
    console.log('通知系统已初始化');
  },
  
  initEventSource: function() {
    // 使用Server-Sent Events监听服务器消息
    const eventSource = new EventSource('/notifications');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.showNotification(data.message);
      } catch (error) {
        console.error('解析通知消息失败:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('通知连接错误:', error);
      // 如果连接关闭，尝试重连
      setTimeout(() => this.initEventSource(), 5000);
      eventSource.close();
    };
  },
  
  showNotification: function(message) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // 添加到容器
    this.container.appendChild(notification);
    
    // 确保通知数量限制
    this.notificationCount++;
    while (this.container.children.length > this.maxNotifications) {
      this.container.removeChild(this.container.children[0]);
      this.notificationCount--;
    }
    
    // 显示通知
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 设置自动消失
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode === this.container) {
          this.container.removeChild(notification);
          this.notificationCount--;
        }
      }, 300);
    }, 5000);
  }
};

// 页面加载完成后初始化通知系统
document.addEventListener('DOMContentLoaded', function() {
  notificationSystem.init();
}); 