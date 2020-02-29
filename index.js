var express = require('express');
var Neode = require('neode');
var neo4j = require('neo4j-driver');
const instance = new Neode('bolt://localhost:7687', 'neo4j', '1234', true);
var driver = neo4j.driver('neo4j://localhost', neo4j.auth.basic('neo4j', '1234'));
var bodyParser = require('body-parser');
const Person = require('./models/Person');
const Class = require('./models/Class');
const { uuid } = require('uuidv4');
var session = driver.session();

var app = express();
app.use(bodyParser.json());

instance.model('Person', Person);
instance.model('Class', Class);

instance.extend('Person', 'Student', {
    is_student: {
        type: "relationship",
        target: "Class",
        relationship: "is_student",
        direction: "out",
        cascade: "detach",
        properties: {
            uuid: {
                primary: true,
                type: 'uuid',
                required: true,
            }
        }
    }
});

instance.extend('Person', 'Teacher', {
    is_teacher: {
        type: "relationship",
        target: "Class",
        relationship: "is_teacher",
        direction: "out",
        cascade: "detach",
        properties: {
            uuid: {
                primary: true,
                type: 'uuid',
                required: true,
            }
        }
    }
});

instance.model('Class').relationship('has_teacher', 'relationship', 'has_teacher', 'out', 'Teacher', {
        uuid: {
            primary: true,
            type: 'uuid',
            required: true,
        },
    }, true, false);

instance.model('Class').relationship('has_student', 'relationship', 'has_student', 'out', 'Student', {
        uuid: {
            primary: true,
            type: 'uuid',
            required: true,
        },
    }, true, false);

//===========================================Teacher===================================

//add teacher
app.post('/teacher/:name', function (req, res) {
    instance.create('Teacher', {
        name: req.params.name
        })
    .then(teacher => {
       res.send(teacher.properties());
    })
    .catch(error=> {
        res.send(error.message)
    });

});

/*add class to teacher
Data Params =>
    uuid_teacher
    uuid_class
 */
app.post('/add_class_to_teacher', async function (req, res) {
    const txc = session.beginTransaction();
    try {
        await txc.run('MATCH (t:Teacher),(c:Class) WHERE t.uuid = $uuid_teacher AND c.uuid = $uuid_class CREATE (t)-[r:is_teacher{uuid: $uuid}]->(c) RETURN type(r)',
            {
                uuid_class: req.query.uuid_class,
                uuid_teacher: req.query.uuid_teacher,
                uuid: uuid()
            }
        );
        await txc.run('MATCH (t:Teacher),(c:Class) WHERE t.uuid = $uuid_teacher AND c.uuid = $uuid_class CREATE (c)-[r:has_teacher{uuid: $uuid}]->(t) RETURN type(r)',
            {
                uuid_class: req.query.uuid_class,
                uuid_teacher: req.query.uuid_teacher,
                uuid: uuid()

            }
        );
        await txc.commit().then(()=>res.send('relationship successful added'))
    } catch (error) {
        await txc.rollback().then(()=>res.send(error.message));
    }
});

/*update teacher name
Data Params =>
    uuid_teacher
    teacher_name
*/
app.post('/update_teacher_name', function (req,res) {
    session
        .run('MATCH (teacher { uuid: $uuid_teacher })SET teacher.name = $teacher_name RETURN teacher.name',
            {
                uuid_teacher: req.query.uuid_teacher,
                teacher_name: req.query.teacher_name
            })
        .then(result => {
            res.send('updated teacher name');
        })
        .catch(error=> {
            res.send(error.message)
        });
});

//get teacher by uuid
app.get('/teacher/:uuid', function (req, res) {
    instance.find('Teacher', req.params.uuid)
        .then(teacher => {
            res.send(teacher.properties());
        })
        .catch(error=> {
            res.send(error.message)
        });

});

// get class teacher
app.get('/class_teacher/:uuid_class', function (req,res) {
    var response = [];
    session
        .run('MATCH (Class { uuid: $uuid_class })-[r:has_teacher]->(Teacher) return Teacher',
            {
                uuid_class: req.params.uuid_class
        })
        .then(array => {
            array.records.forEach(result=>{
                var teacher = result.toObject().Teacher.properties;
                response.push(teacher);
            });
            res.send(response);
        })
        .catch(error=> {
            res.send(error.message)
        });
});

//delete all teacher
app.delete('/teachers', function(req, res){
    instance.deleteAll('Teacher')
        .then(() =>{
            res.send('Everyone Teachers has been deleted')
        })
        .catch(error=> {
            res.send(error.message)
        });
});

//delete teacher by uuid
app.delete('/teacher/:uuid', function(req, res){
    instance.find('Teacher', req.params.uuid)
        .then(teacher => {
            teacher.delete()
                .then(()=> res.send("Teacher deleted"));
        })
        .catch(error=>{
            res.send(error.message)
        });

});

/*delete class from teacher
Data Params =>
    uuid_teacher
    teacher_name
*/
app.delete('/class_from_teacher', async function (req,res) {
    const txc = session.beginTransaction();
    try {
        await txc.run('MATCH (class { uuid: $uuid_class })-[r:has_teacher]->(teacher{uuid: $uuid_teacher}) delete r',
            {
                uuid_class: req.query.uuid_class,
                uuid_teacher: req.query.uuid_teacher
            }
        );
        await txc.run('MATCH (teacher { uuid: $uuid_teacher })-[r:is_teacher]->(class{uuid: $uuid_class}) delete r',
            {
                uuid_class: req.query.uuid_class,
                uuid_teacher: req.query.uuid_teacher
            }
        );
        await txc.commit().then(()=>res.send('relationship successful deleted'))
    } catch (error) {
        await txc.rollback().then(()=>res.send(error.message));
    }
});

//===========================================Student===================================
//add student
app.post('/student/:name', function (req, res) {
    instance.create('Student', {
        name: req.params.name
    })
    .then(student => {
        res.send(student.properties());
    })
    .catch(error=> {
        res.send(error.message)
    });

});

// get class students
app.get('/class_student/:uuid_class', function (req,res) {
    var response = [];
    session
        .run('MATCH (Class { uuid: $uuid_class })-[r:has_student]->(Student) return Student',
        {
            uuid_class: req.params.uuid_class
        })
        .then(array => {
            array.records.forEach(result=>{
                var student = result.toObject().Student.properties;
                response.push(student);
            });
            res.send(response);
        })
        .catch(error=> {
            res.send(error.message)
        });
});

/*add class to student
Data Params =>
    uuid_student
    uuid_class
*/
app.post('/add_class_to_student', async function (req, res) {
    const txc = session.beginTransaction();
    try {
        await txc.run('MATCH (s:Student),(c:Class) WHERE s.uuid = $uuid_student AND c.uuid = $uuid_class CREATE (s)-[r:is_student{uuid: $uuid}]->(c) RETURN type(r)',
            {
                uuid_class: req.query.uuid_class,
                uuid_student: req.query.uuid_student,
                uuid: uuid()
            }
        );
        await txc.run('MATCH (s:Student),(c:Class) WHERE s.uuid = $uuid_student AND c.uuid = $uuid_class CREATE (c)-[r:has_student{uuid: $uuid}]->(s) RETURN type(r)',
            {
                uuid_class: req.query.uuid_class,
                uuid_student: req.query.uuid_student,
                uuid: uuid()
            }
        );
        await txc.commit().then(()=>res.send('relationship successful added'))
    } catch (error) {
        await txc.rollback().then(()=>res.send(error.message));
    }
});

/*delete class from student
Data Params =>
    uuid_class
    uuid_student
 */
app.delete('/class_from_student', async function (req,res) {
    const txc = session.beginTransaction();
    try {
        await txc.run('MATCH (class { uuid: $uuid_class })-[r:has_student]->(student{uuid: $uuid_student}) delete r',
            {
                uuid_class: req.query.uuid_class,
                uuid_student: req.query.uuid_student
            }
        );
        await txc.run('MATCH (student { uuid: $uuid_student })-[r:is_student]->(class{uuid: $uuid_class}) delete r',
            {
                uuid_class: req.query.uuid_class,
                uuid_student: req.query.uuid_student
            }
        );
        await txc.commit().then(()=>res.send('relationship successful deleted'))
    } catch (error) {
        await txc.rollback().then(()=>res.send(error.message));
    }
});

/*update student name
Data Params =>
    uuid_student
    student_name
*/
app.post('/update_student_name', function (req,res) {
    session
        .run('MATCH (student { uuid: $uuid_student })SET student.name = $student_name RETURN student.name',
            {
                uuid_student: req.query.uuid_student,
                student_name: req.query.student_name
            })
        .then(result => {
            res.send('updated student name');
        })
        .catch(error=> {
            res.send(error.message)
        });
});

//get student by uuid
app.get('/student/:uuid', function (req, res) {
    instance.find('Student', req.params.uuid)
        .then(student => {
            res.send(student.properties());
        })
        .catch(error=>{
            res.send(error.message)
        });

});

//delete all students
app.delete('/students', function(req, res){
    instance.deleteAll('Student')
        .then(() => res.send('Everyone Students has been deleted'))
        .catch(error=> {
            res.send(error.message)
        });
});

//delete student by uuid
app.delete('/student/:uuid', function(req, res){
    instance.find('Student', req.params.uuid)
        .then(student => {
            student.delete()
                .then(()=> res.send("Student deleted"));
        })
        .catch(error=> {
            res.send(error.message)
        });

});

//===========================================Class===================================

//add class
app.post('/class/:name', function (req, res) {
    instance.create('Class', {
        name: req.params.name
    })
    .then(_class => {
        res.send(_class.properties());
    })
    .catch(error=> {
        res.send(error.message)
    });

});

//get class by uuid
app.get('/class/:uuid', function (req, res) {
    instance.find('Class', req.params.uuid)
    .then(_class => {
        res.send(_class.properties());
    })
    .catch(error=> {
        res.send(error.message)
    });

});

/*update class name
Data Params =>
    uuid_class
    class_name
*/
app.post('/update_class_name', function (req,res) {
    session
        .run('MATCH (class { uuid: $uuid_class })SET class.name = $class_name RETURN class.name',
            {
                uuid_class: req.query.uuid_class,
                class_name: req.query.class_name
            })
        .then(result => {
            res.send('updated class name');
        })
        .catch(error=> {
            res.send(error.message)
        });
});

//delete all classes
app.delete('/classes', function(req, res){
    instance.deleteAll('Class')
    .then(() => res.send('All Classes has been deleted'))
    .catch(error=> {
        res.send(error.message)
    });
});

//delete class by uuid
app.delete('/class/:uuid', function(req, res){
    instance.find('Class', req.params.uuid)
    .then(_class => {
        _class.delete()
            .then(() => res.send("Class deleted"));
    })
    .catch(error=> {
        res.send(error.message)
    });
});



app.listen(3000);
console.log('server started on port 3000');

module.exports= app;
