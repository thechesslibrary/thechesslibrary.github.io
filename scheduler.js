class Scheduler {
    constructor() {
        this.cycleToken = this.generateToken();
        this.tokenLocked = false;
        this.lockRevisitDelay = 100;
    }
    push(task, revisiting=false) {
        if (task.token != this.cycleToken) return;
        if (task.sleep > 0 && !revisiting) {
            setTimeout(() => this.push(task, true), task.sleep);
            return;
        }
        if (this.tokenLocked) {
            setTimeout(() => this.push(task, true), this.lockRevisitDelay);
            return;
        }
        if (task.startNewSession) {
            this.cycleToken = this.generateToken();
            task.token = this.cycleToken;
            console.log("new session", this.cycleToken);
        }
        if (task.lock) {
            this.tokenLocked = true;
        }
        task.execute().then((chainedTaskData) => {
            if (task.lock)
                this.unlock();
            if (!chainedTaskData) return;
            let chainedTask = chainedTaskData.task;
            let chainedToken = chainedTaskData.token;
            chainedTask.setToken(chainedToken);
            this.push(chainedTask);
        });
    }
    generateToken() {
        return Math.random().toString(16).slice(2);
    }
    unlock () {
        this.tokenLocked = false;
    }
    force(task) {
        task.token = this.cycleToken;
        this.push(task);
    }
}

class ScheduledTask {
    constructor(func=null, args=[], token=null, lock=false, startNewSession=false, sleep=10) {
        this.token = token;
        this.startNewSession = startNewSession;
        this.sleep = sleep;
        this.func = func ? func : () => { };
        this.args = args;
        this.lock = lock;

    }
    set(func, ...args) {
        this.func = func;
        this.args = args;
        return this;
    }
    setNewSession(bool) {
        this.startNewSession = bool;
        return this;
    }
    setLock(bool) {
        this.lock = bool;
        return this;
    }
    setSleep(ms) {
        this.sleep = ms;
        return this;
    }
    setToken(token) {
        this.token = token;
        return this;
    }
    execute() {
        return new Promise((resolve, reject) => {
            const res = this.func(...this.args);
            if (res instanceof ScheduledTask) {
                resolve({"task": res, "token": this.token});
            }
            resolve(null);
        });
    }
}