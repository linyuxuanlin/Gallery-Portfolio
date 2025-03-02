// 通知系统
const notificationSystem = {
  container: null,
  notificationCount: 0,
  maxNotifications: 3,
  activeNotifications: {}, // 存储活跃的通知，用于更新状态
  
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
        
        // 检查消息类型是否为缩略图处理相关
        if (data.message && data.message.startsWith('正在生成缩略图:')) {
          // 提取图片名称作为ID
          const imageId = data.message.split(':')[1].trim();
          // 创建持久性的带加载图标的通知
          this.showPersistentNotification(data.message, imageId);
        } else if (data.message && data.message.startsWith('缩略图生成完成:')) {
          // 处理缩略图完成的消息
          const imageId = data.message.split(':')[1].trim();
          // 移除对应的持久性通知
          this.removeNotification(imageId);
        } else if (data.message && data.message.startsWith('缩略图生成失败:')) {
          // 处理缩略图失败的消息
          const imageId = data.message.split(':')[1].trim();
          // 移除对应的持久性通知
          this.removeNotification(imageId);
          // 显示错误通知
          this.showNotification(`缩略图生成失败: ${imageId}`, null, false);
        } else {
          // 处理其他普通通知
          this.showNotification(data.message);
        }
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
  
  // 显示临时通知（自动消失）
  showNotification: function(message, id = null, autoFade = true) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // 如果提供了ID，设置为数据属性
    if (id) {
      notification.dataset.id = id;
      this.activeNotifications[id] = notification;
    }
    
    // 添加文本消息
    notification.textContent = message;
    
    // 添加到容器
    this.container.appendChild(notification);
    
    // 确保通知数量限制
    this.notificationCount++;
    while (this.container.children.length > this.maxNotifications) {
      // 只移除非持久性通知
      const oldestNotification = Array.from(this.container.children)
        .find(n => !n.classList.contains('persistent'));
      
      if (oldestNotification) {
        this.container.removeChild(oldestNotification);
        this.notificationCount--;
      } else {
        break; // 如果所有通知都是持久性的，停止移除
      }
    }
    
    // 显示通知
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 设置自动消失（如果不是持久性通知）
    if (autoFade) {
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
          if (notification.parentNode === this.container) {
            this.container.removeChild(notification);
            this.notificationCount--;
            
            // 从活跃通知列表中移除
            if (id && this.activeNotifications[id]) {
              delete this.activeNotifications[id];
            }
          }
        }, 300);
      }, 5000);
    }
    
    return notification;
  },
  
  // 显示持久性通知（带加载图标）
  showPersistentNotification: function(message, id) {
    // 检查是否已存在相同ID的通知
    if (id && this.activeNotifications[id]) {
      // 已存在，不需要创建新的
      return;
    }
    
    // 创建通知元素
    const notification = this.showNotification(message, id, false);
    notification.classList.add('persistent', 'with-spinner');
    
    // 清空原有内容并添加加载图标和文本
    notification.textContent = '';
    
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    notification.appendChild(spinner);
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    notification.appendChild(textSpan);
    
    return notification;
  },
  
  // 移除指定ID的通知
  removeNotification: function(id) {
    if (id && this.activeNotifications[id]) {
      const notification = this.activeNotifications[id];
      notification.classList.add('fade-out');
      
      setTimeout(() => {
        if (notification.parentNode === this.container) {
          this.container.removeChild(notification);
          this.notificationCount--;
          delete this.activeNotifications[id];
        }
      }, 300);
    }
  }
};

// 页面加载完成后初始化通知系统
document.addEventListener('DOMContentLoaded', function() {
  notificationSystem.init();
}); 