import * as supertest from 'supertest';
import 'jest';

const request = supertest('http://localhost:30123/user');
const options: any = {
    userInfo: {
        ID: null
    }
};

describe('Добавление нового пользователя', () => {
    it('204 (Добавить в БД)', (done) => {
      request.post('/add')
        .send({
            Login: 'root',
            Password: 'test123',
            FIO: 'Тестовый Тест Тестович',
            Role: 'admin'
        })
        .expect(204, done);
    });

    // it("400 (Пользователь с таким Email уже существует)", (done) => {
    //   request.post("/add")
    //     .send({
    //         Login: "NewTest",
    //         Email: "test@mail.ru",
    //         Nikname: "incorrect",
    //         Password: "testadmin",
    //     })
    //     .expect(400)
    //     .then(res => {
    //         expect(res.body.message)
    //             .toBe("Пользователь с таким Email уже существует");
    //         done();
    //     });
    // });

    // it("400 (Не корректный Email адрес)", (done) => {
    //     request.post("/add")
    //         .send({
    //             Login: "NewTest",
    //             Email: "testmail.ru",
    //             Nikname: "incorrect",
    //             Password: "testadmin",
    //         })
    //         .expect(400)
    //         .then(res => {
    //             expect(res.body.msg)
    //                 .toBe("Не корректный Email адрес");
    //             done();
    //         });
    // });
});

// describe("Авторизация", () => {
//     it("400 (Пароль не может быть пустым)", (done) => {
//         request.post("/login")
//             .send({
//                 Email: "test@mail.ru"
//             })
//             .expect(400)
//             .then(res => {
//                 expect(res.body.msg)
//                     .toBe("Пароль не может быть пустым");
//                 done();
//             });
//     });

//     it("400 (Не корректный Email адрес)", (done) => {
//         request.post("/login")
//             .send({
//                 Email: "testmail.ru",
//                 Password: "testadmin"
//             })
//             .expect(400)
//             .then(res => {
//                 expect(res.body.msg)
//                     .toBe("Не корректный Email адрес");
//                 done();
//             });
//     });
//     it("404 (Не корректный пароль)", (done) => {
//         request.post("/login")
//             .send({
//                 Email: "test@mail.ru",
//                 Password: "incorrect",
//             })
//             .expect(404)
//             .then(res => {
//                 expect(res.body.msg).toBe("Не корректный пароль");
//                 done();
//             });
//     });
//     it("404 (Пользователь с таким Email отсутствует)", (done) => {
//         request.post("/login")
//             .send({
//                 Email: "test1@mail.ru",
//                 Password: "incorrect",
//             })
//             .expect(404)
//             .then(res => {
//                 expect(res.body.msg)
//                     .toBe("Пользователь с таким Email отсутствует");
//                 done();
//             });
//     });

//     it("200 (Успешно)", (done) => {
//         request.post("/login")
//             .send({
//                 Email: "test@mail.ru",
//                 Password: "testadmin",
//             })
//             .expect(200)
//             .then(res => {
//                 expect(res.body.Login).toBe("Test");
//                 expect(res.body.Nikname).toBe("IAmTest");
//                 expect(res.body.IsBlocked).toBe(false);
//                 options.userInfo.ID = res.body.ID;
//                 done();
//             });
//     });
// });

// describe("Удаление пользователя", () => {

//     it("should return 400 OK", (done) => {
//         request.get(`/logout/${options.userInfo.ID}`)
//             .expect(200, done);
//     });
// });



